import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import {
  clinicCalendarToday,
  resolveToolParams,
} from './copilot-params.builder';
import { CopilotPresenterService } from './copilot-presenter.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { ContextBuilderService } from './context/context-builder.service';
import { PromptLibrary } from './prompts/prompt-library';
import { IntentDetectorService } from './intent/intent-detector.service';
import { CopilotMemoryService } from './v2/copilot-memory.service';
import { CopilotExecutionEngine } from './v2/copilot-execution.engine';
import { extractPrimaryAssistantText } from './copilot-response-composer';
import { CopilotReasoningService } from './v2/copilot-reasoning.service';
import { safeParseNlSearchPlan, type ParsedNlSearchPlan } from './v2/search-nl-plan.schema';
import {
  normalizeSearchToolArgs,
  paramsToSearchFilters,
  type SearchToolName,
} from './v2/search-tool-args';
import type { ToolPlan } from './v2/copilot-v2.types';
import type { AuthContext } from '../../common/auth-context';
import type { CopilotRequestDto } from './dto/copilot-request.dto';
import type { DetectedIntent, IntentType } from './intent/intent.types';
import type { ToolResult } from './tools/tool.types';

export interface CopilotResponse {
  intent: string;
  tool_used: string | null;
  response: string;
  structured_data: Record<string, unknown> | null;
  metadata: {
    confidence: string;
    language: string;
    model_used: string;
    processing_time_ms: number;
  };
}

/**
 * Hybrid pipeline (v1 UX + v2 safety):
 * IntentDetector → resolveToolParams → ToolRegistry.executeForIntent (auth/policy inside registry).
 * Most intents ask the model for JSON; {@link CopilotPresenterService} turns that into readable prose
 * plus next steps / disclaimers. Scheduling “list/count” uses plain Arabic text from the lister prompt.
 * Search intent uses NL→JSON + ExecutionEngine. v2 memory and tool validation stay enabled.
 */
@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  constructor(
    private readonly intentDetector: IntentDetectorService,
    private readonly execution: CopilotExecutionEngine,
    private readonly memory: CopilotMemoryService,
    private readonly reasoning: CopilotReasoningService,
    private readonly presenter: CopilotPresenterService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly contextBuilder: ContextBuilderService,
    private readonly config: ConfigService,
  ) {}

  async process(
    dto: CopilotRequestDto,
    auth: AuthContext,
  ): Promise<CopilotResponse> {
    const startedAt = Date.now();
    const detected = await this.intentDetector.detect(dto.input);
    const params = resolveToolParams(dto, detected);

    this.logger.debug(
      `Intent: ${detected.intent} (${detected.confidence}) | lang: ${detected.language}`,
    );

    const clinicalPatientId =
      dto.context?.patientId ?? params.patientId;
    if (detected.intent === 'clinical' && !clinicalPatientId) {
      return {
        intent: 'clinical',
        tool_used: null,
        response:
          'يرجى اختيار مريض من الواجهة أو إرسال معرف المريض (patientId) ضمن السياق لعرض الملخص الإكلينيكي.',
        structured_data: { needs_patient_context: true },
        metadata: {
          confidence: detected.confidence,
          language: detected.language,
          model_used: 'n/a',
          processing_time_ms: Date.now() - startedAt,
        },
      };
    }

    if (detected.intent === 'search') {
      return this.processSearchIntent(dto, auth, detected, startedAt);
    }

    const toolResults = await this.toolRegistry.executeForIntent(
      detected.intent,
      auth,
      params,
    );

    const memPrefix = await this.memory.formatPromptPrefix(auth, dto.sessionId);
    const contextString =
      memPrefix +
      this.contextBuilder.buildContextString(
        detected.intent,
        toolResults,
        auth.tenantId,
      );

    const { systemPrompt, userMessage } = this.renderPrompt(
      detected,
      dto.input,
      contextString,
    );

    const isListing = Boolean(params.isListingQuery);
    const useJsonMime = this.expectsStructuredJsonAnswer(
      detected.intent,
      params,
    );
    const llmResponse = await this.reasoning.generate({
      systemPrompt,
      userMessage,
      temperature: isListing ? 0.1 : 0.3,
      maxTokens: this.maxTokensForAnswer(detected.intent),
      responseFormat: useJsonMime ? 'json' : 'text',
      model: this.modelForIntent(detected.intent, isListing),
    });

    const shaped = this.finalizeUserFacingReply(
      llmResponse.text ?? '',
      detected.intent,
      detected.language,
      params,
    );
    const response = shaped.response;

    let finalStructuredData: Record<string, unknown> | null = null;
    if (detected.intent !== 'general') {
      finalStructuredData = this.attachToolMetadata(detected, toolResults);
    }
    if (shaped.structuredData) {
      finalStructuredData = {
        ...(finalStructuredData ?? {}),
        ...shaped.structuredData,
      };
    }

    if (detected.intent === 'scheduling' && params.isListingQuery) {
      const apptResult = toolResults.find((t) => t.tool === 'searchAppointments');
      if (apptResult?.data && Array.isArray(apptResult.data)) {
        finalStructuredData = {
          ...(finalStructuredData ?? {}),
          results_preview: apptResult.data.slice(0, 15),
          result_count: apptResult.data.length,
        };
      }
    }

    await this.persistMemory(dto, auth, detected, params, toolResults);

    return {
      intent: detected.intent,
      tool_used: this.primaryTool(toolResults),
      response,
      structured_data: finalStructuredData,
      metadata: {
        confidence: detected.confidence,
        language: detected.language,
        model_used: llmResponse.model,
        processing_time_ms: Date.now() - startedAt,
      },
    };
  }

  async processStream(
    dto: CopilotRequestDto,
    auth: AuthContext,
    res: Response,
  ): Promise<void> {
    const startedAt = Date.now();
    const write = (ev: Record<string, unknown>) => {
      res.write(`${JSON.stringify(ev)}\n`);
    };

    const defaultModel =
      this.config.get<string>('GEMINI_MODEL')?.trim() ||
      'gemini-3.1-flash-lite-preview';

    try {
      const detected = await this.intentDetector.detect(dto.input);
      const params = resolveToolParams(dto, detected);

      write({
        type: 'intent',
        intent: detected.intent,
        confidence: detected.confidence,
        language: detected.language,
      });

      const clinicalPatientId =
        dto.context?.patientId ?? params.patientId;
      if (detected.intent === 'clinical' && !clinicalPatientId) {
        write({
          type: 'done',
          intent: 'clinical',
          tool_used: null,
          response:
            'يرجى اختيار مريض من الواجهة أو إرسال معرف المريض (patientId) ضمن السياق لعرض الملخص الإكلينيكي.',
          structured_data: { needs_patient_context: true },
          metadata: {
            confidence: detected.confidence,
            language: detected.language,
            model_used: 'n/a',
            processing_time_ms: Date.now() - startedAt,
          },
        });
        res.end();
        return;
      }

      if (detected.intent === 'search') {
        const result = await this.processSearchIntent(
          dto,
          auth,
          detected,
          startedAt,
        );
        write({
          type: 'done',
          intent: result.intent,
          tool_used: result.tool_used,
          response: result.response,
          structured_data: result.structured_data,
          metadata: {
            ...result.metadata,
            model_used: result.metadata.model_used ?? defaultModel,
          },
        });
        res.end();
        return;
      }

      const toolResults = await this.toolRegistry.executeForIntent(
        detected.intent,
        auth,
        params,
      );

      write({
        type: 'tools',
        tool_used: this.primaryTool(toolResults),
      });

      const memPrefix = await this.memory.formatPromptPrefix(auth, dto.sessionId);
      const contextString =
        memPrefix +
        this.contextBuilder.buildContextString(
          detected.intent,
          toolResults,
          auth.tenantId,
        );
      const { systemPrompt, userMessage } = this.renderPrompt(
        detected,
        dto.input,
        contextString,
      );

      const isListingStream = Boolean(params.isListingQuery);
      const streamModel = this.modelForIntent(
        detected.intent,
        isListingStream,
      );
      const streamUseJson = this.expectsStructuredJsonAnswer(
        detected.intent,
        params,
      );
      let full = '';
      for await (const chunk of this.reasoning.generateStream({
        systemPrompt,
        userMessage,
        temperature: isListingStream ? 0.1 : 0.3,
        maxTokens: this.maxTokensForAnswer(detected.intent),
        responseFormat: streamUseJson ? 'json' : 'text',
        model: streamModel,
      })) {
        full += chunk;
        write({ type: 'chunk', text: chunk });
      }

      const streamShaped = this.finalizeUserFacingReply(
        full,
        detected.intent,
        detected.language,
        params,
      );
      const response = streamShaped.response;

      let finalStreamStructured: Record<string, unknown> | null = null;
      if (detected.intent !== 'general') {
        finalStreamStructured = this.attachToolMetadata(detected, toolResults);
      }
      if (streamShaped.structuredData) {
        finalStreamStructured = {
          ...(finalStreamStructured ?? {}),
          ...streamShaped.structuredData,
        };
      }

      if (detected.intent === 'scheduling' && params.isListingQuery) {
        const apptResult = toolResults.find((t) => t.tool === 'searchAppointments');
        if (apptResult?.data && Array.isArray(apptResult.data)) {
          finalStreamStructured = {
            ...(finalStreamStructured ?? {}),
            results_preview: apptResult.data.slice(0, 15),
            result_count: apptResult.data.length,
          };
        }
      }

      await this.persistMemory(dto, auth, detected, params, toolResults);

      write({
        type: 'done',
        intent: detected.intent,
        tool_used: this.primaryTool(toolResults),
        response,
        structured_data: finalStreamStructured,
        metadata: {
          confidence: detected.confidence,
          language: detected.language,
          model_used: streamModel,
          processing_time_ms: Date.now() - startedAt,
        },
      });
      res.end();
    } catch (err: unknown) {
      let msg: string;
      let code = 'STREAM_ERROR';

      if (err instanceof HttpException) {
        const body = err.getResponse();
        if (typeof body === 'object' && body !== null && 'message' in body) {
          const rawMsg = (body as { message?: string | string[] }).message;
          msg = Array.isArray(rawMsg)
            ? rawMsg.join(', ')
            : String(rawMsg ?? err.message);
          const c = (body as { code?: string }).code;
          if (c) code = c;
        } else {
          msg = typeof body === 'string' ? body : err.message;
        }
      } else if (err instanceof Error) {
        msg = err.message || 'Copilot stream failed';
        if (
          err.name === 'EmptyError' ||
          msg.includes('no elements in sequence')
        ) {
          msg =
            'انقطع تدفق الرد من خدمة الذكاء الاصطناعي — قد تكون الحصة منتهية. حاول بعد قليل.';
          code = 'AI_STREAM_EMPTY';
        }
      } else {
        msg = typeof err === 'string' ? err : 'Copilot stream failed';
      }

      write({
        type: 'error',
        message: msg,
        code,
      });
      res.end();
    }
  }

  private modelForIntent(intent: IntentType, isListing = false): string | undefined {
    const override = this.config.get<string>('GEMINI_MODEL')?.trim();
    if (override) return override;

    void intent;
    void isListing;
    return 'gemini-3.1-flash-lite-preview';
  }

  private maxTokensForAnswer(intent: IntentType): number {
    switch (intent) {
      case 'clinical':
        return 2048;
      case 'scheduling':
        return 1024;
      case 'finance':
      case 'communication':
        return 896;
      case 'search':
        return 640;
      default:
        return 768;
    }
  }

  /** Prompts (except scheduling lister + general) request JSON; Gemini JSON MIME improves validity. */
  private expectsStructuredJsonAnswer(
    intent: IntentType,
    params: Record<string, unknown>,
  ): boolean {
    if (intent === 'general') return false;
    if (intent === 'scheduling' && params.isListingQuery === true) return false;
    return true;
  }

  /**
   * Rich UX from JSON prompts via {@link CopilotPresenterService}; plain text for lister + general.
   */
  private finalizeUserFacingReply(
    raw: string,
    intent: IntentType,
    language: string,
    params: Record<string, unknown>,
  ): { response: string; structuredData: Record<string, unknown> | null } {
    if (intent === 'general') {
      return { response: this.formatAssistantReply(raw), structuredData: null };
    }
    if (intent === 'scheduling' && params.isListingQuery === true) {
      const t = raw.trim() || '—';
      return { response: t, structuredData: null };
    }
    return this.presenter.composeFromLlmJson(raw, intent, { language });
  }

  private renderPrompt(
    detected: DetectedIntent,
    input: string,
    contextString: string,
  ): { systemPrompt: string; userMessage: string } {
    const clinicPhone =
      this.config.get<string>('CLINIC_PHONE')?.trim() || '(clinic phone)';
    const vars = {
      input,
      context: contextString,
      current_date: clinicCalendarToday(),
      clinic_phone: clinicPhone,
    };

    const promptTemplate =
      detected.intent === 'scheduling'
        ? PromptLibrary.selectSchedulingPrompt(input)
        : PromptLibrary.getDefaultForIntent(detected.intent);

    if (!promptTemplate) {
      const general = PromptLibrary.getGeneralAssistantPrompt();
      return PromptLibrary.render(
        { id: 'general', system: general.systemPrompt, user: general.userMessage },
        vars,
      );
    }

    return PromptLibrary.render(promptTemplate, vars);
  }

  /** General-intent cleanup; shared logic in {@link extractPrimaryAssistantText}. */
  private formatAssistantReply(raw: string): string {
    return extractPrimaryAssistantText(raw);
  }

  private primaryTool(results: ToolResult[]): string | null {
    const successful = results.find((r) => !r.error);
    return successful?.tool ?? null;
  }

  private attachToolMetadata(
    detected: DetectedIntent,
    toolResults: ToolResult[],
  ): Record<string, unknown> {
    return {
      intent_confidence: detected.confidence,
      tools_executed: toolResults.map((t) => t.tool),
    };
  }

  private async persistMemory(
    dto: CopilotRequestDto,
    auth: AuthContext,
    detected: DetectedIntent,
    params: Record<string, unknown>,
    toolResults: ToolResult[],
  ): Promise<void> {
    await this.memory.remember(
      auth,
      {
        lastInput: dto.input.slice(0, 500),
        lastIntent: detected.intent,
        lastPatientId:
          params.patientId != null ? String(params.patientId) : undefined,
        lastDoctorId:
          params.doctorId != null ? String(params.doctorId) : undefined,
        lastToolSummary: this.memory.digestToolsSummary(
          detected.intent,
          toolResults.map((t) => t.tool),
        ),
      },
      dto.sessionId,
    );
  }

  private async processSearchIntent(
    dto: CopilotRequestDto,
    auth: AuthContext,
    detected: DetectedIntent,
    startedAt: number,
  ): Promise<CopilotResponse> {
    const clinicPhone =
      this.config.get<string>('CLINIC_PHONE')?.trim() || '(clinic phone)';
    const rendered = PromptLibrary.render(
      PromptLibrary.search.naturalLanguageQueryConverter,
      {
        input: dto.input,
        context: '',
        current_date: clinicCalendarToday(),
        clinic_phone: clinicPhone,
      },
    );

    let parsedNl: ParsedNlSearchPlan;
    let nlModel = 'n/a';

    try {
      const nlResponse = await this.reasoning.generate({
        systemPrompt: rendered.systemPrompt,
        userMessage: rendered.userMessage,
        temperature: 0.05,
        maxTokens: 768,
        responseFormat: 'json',
      });
      nlModel = nlResponse.model;
      const raw = this.reasoning.parseJson<unknown>(nlResponse.text);
      const sp = safeParseNlSearchPlan(raw);
      if (!sp.success) {
        throw new Error('nl_plan_invalid');
      }
      parsedNl = sp.data;
    } catch {
      parsedNl = this.nlSearchHeuristicPlan(dto);
      nlModel = 'fallback-heuristic';
    }

    const args = normalizeSearchToolArgs(
      parsedNl.tool,
      parsedNl.filters ?? {},
    );
    const primaryPlans: ToolPlan[] = [
      {
        tool: parsedNl.tool,
        args,
        reason: 'nl_search_plan_validated',
      },
    ];

    let toolResults = await this.execution.execute(auth, primaryPlans);

    if (toolResults.every((r) => r.error)) {
      toolResults = await this.execution.execute(
        auth,
        this.buildSearchFallbackToolPlans(dto, detected),
      );
    }

    const primary =
      toolResults.find((r) => !r.error) ?? toolResults[0];
    const rows = primary?.data;
    const count = Array.isArray(rows) ? rows.length : rows != null ? 1 : 0;

    const displayQ =
      parsedNl.display_query?.trim() ||
      dto.input.trim() ||
      (detected.language === 'ar' ? 'البحث' : 'search');
    const response = this.presenter.buildSearchNarrative(
      primary?.tool,
      primary?.data,
      primary?.error,
      displayQ,
      detected.language,
    );

    const confidenceMeta =
      parsedNl.confidence != null
        ? String(parsedNl.confidence)
        : detected.confidence;

    const structured_data: Record<string, unknown> = {
      nl_plan: parsedNl as unknown as Record<string, unknown>,
      result_count: count,
      results_preview: Array.isArray(rows) ? rows.slice(0, 15) : rows,
      tools_executed: toolResults.map((t) => t.tool),
    };

    await this.memory.remember(
      auth,
      {
        lastInput: dto.input.slice(0, 500),
        lastIntent: 'search',
        lastToolSummary: this.memory.digestToolsSummary(
          'search',
          toolResults.map((t) => t.tool),
        ),
      },
      dto.sessionId,
    );

    return {
      intent: 'search',
      tool_used: primary?.tool ?? null,
      response,
      structured_data,
      metadata: {
        confidence: confidenceMeta,
        language: detected.language,
        model_used: nlModel,
        processing_time_ms: Date.now() - startedAt,
      },
    };
  }

  /** Deterministic NL plan when LLM output fails schema validation. */
  private nlSearchHeuristicPlan(dto: CopilotRequestDto): ParsedNlSearchPlan {
    const looksUnpaid =
      /ما دفع|لم يدفع|غير مدفوع|بدون دفع|unpaid|متأخر/i.test(dto.input);
    if (looksUnpaid) {
      return {
        tool: 'searchInvoices',
        filters: { unpaid: true },
        display_query: dto.input,
        confidence: 'low',
      };
    }
    return {
      tool: 'searchPatients',
      filters: { q: dto.input.slice(0, 2000) },
      display_query: dto.input,
      confidence: 'low',
    };
  }

  private buildSearchFallbackToolPlans(
    dto: CopilotRequestDto,
    detected: DetectedIntent,
  ): ToolPlan[] {
    const params = resolveToolParams(dto, detected);
    const tools = this.toolRegistry.getSearchToolsForFallbackParams(params);
    return tools.map((tool) => ({
      tool,
      args: normalizeSearchToolArgs(
        tool as SearchToolName,
        paramsToSearchFilters(tool as SearchToolName, params),
      ),
      reason: 'search_keyword_fallback',
    }));
  }
}
