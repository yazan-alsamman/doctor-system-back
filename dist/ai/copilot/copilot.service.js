"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CopilotService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const copilot_params_builder_1 = require("./copilot-params.builder");
const copilot_presenter_service_1 = require("./copilot-presenter.service");
const tool_registry_service_1 = require("./tools/tool-registry.service");
const context_builder_service_1 = require("./context/context-builder.service");
const prompt_library_1 = require("./prompts/prompt-library");
const intent_detector_service_1 = require("./intent/intent-detector.service");
const copilot_memory_service_1 = require("./v2/copilot-memory.service");
const copilot_execution_engine_1 = require("./v2/copilot-execution.engine");
const copilot_response_composer_1 = require("./copilot-response-composer");
const copilot_reasoning_service_1 = require("./v2/copilot-reasoning.service");
const search_nl_plan_schema_1 = require("./v2/search-nl-plan.schema");
const search_tool_args_1 = require("./v2/search-tool-args");
let CopilotService = CopilotService_1 = class CopilotService {
    intentDetector;
    execution;
    memory;
    reasoning;
    presenter;
    toolRegistry;
    contextBuilder;
    config;
    logger = new common_1.Logger(CopilotService_1.name);
    constructor(intentDetector, execution, memory, reasoning, presenter, toolRegistry, contextBuilder, config) {
        this.intentDetector = intentDetector;
        this.execution = execution;
        this.memory = memory;
        this.reasoning = reasoning;
        this.presenter = presenter;
        this.toolRegistry = toolRegistry;
        this.contextBuilder = contextBuilder;
        this.config = config;
    }
    async process(dto, auth) {
        const startedAt = Date.now();
        const detected = await this.intentDetector.detect(dto.input);
        const params = (0, copilot_params_builder_1.resolveToolParams)(dto, detected);
        this.logger.debug(`Intent: ${detected.intent} (${detected.confidence}) | lang: ${detected.language}`);
        const clinicalPatientId = dto.context?.patientId ?? params.patientId;
        if (detected.intent === 'clinical' && !clinicalPatientId) {
            return {
                intent: 'clinical',
                tool_used: null,
                response: 'يرجى اختيار مريض من الواجهة أو إرسال معرف المريض (patientId) ضمن السياق لعرض الملخص الإكلينيكي.',
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
        const toolResults = await this.toolRegistry.executeForIntent(detected.intent, auth, params);
        const memPrefix = await this.memory.formatPromptPrefix(auth, dto.sessionId);
        const contextString = memPrefix +
            this.contextBuilder.buildContextString(detected.intent, toolResults, auth.tenantId);
        const { systemPrompt, userMessage } = this.renderPrompt(detected, dto.input, contextString);
        const isListing = Boolean(params.isListingQuery);
        const useJsonMime = this.expectsStructuredJsonAnswer(detected.intent, params);
        const llmResponse = await this.reasoning.generate({
            systemPrompt,
            userMessage,
            temperature: isListing ? 0.1 : 0.3,
            maxTokens: this.maxTokensForAnswer(detected.intent),
            responseFormat: useJsonMime ? 'json' : 'text',
            model: this.modelForIntent(detected.intent, isListing),
        });
        const shaped = this.finalizeUserFacingReply(llmResponse.text ?? '', detected.intent, detected.language, params);
        const response = shaped.response;
        let finalStructuredData = null;
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
    async processStream(dto, auth, res) {
        const startedAt = Date.now();
        const write = (ev) => {
            res.write(`${JSON.stringify(ev)}\n`);
        };
        const defaultModel = this.config.get('GEMINI_MODEL')?.trim() ||
            'gemini-3.1-flash-lite-preview';
        try {
            const detected = await this.intentDetector.detect(dto.input);
            const params = (0, copilot_params_builder_1.resolveToolParams)(dto, detected);
            write({
                type: 'intent',
                intent: detected.intent,
                confidence: detected.confidence,
                language: detected.language,
            });
            const clinicalPatientId = dto.context?.patientId ?? params.patientId;
            if (detected.intent === 'clinical' && !clinicalPatientId) {
                write({
                    type: 'done',
                    intent: 'clinical',
                    tool_used: null,
                    response: 'يرجى اختيار مريض من الواجهة أو إرسال معرف المريض (patientId) ضمن السياق لعرض الملخص الإكلينيكي.',
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
                const result = await this.processSearchIntent(dto, auth, detected, startedAt);
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
            const toolResults = await this.toolRegistry.executeForIntent(detected.intent, auth, params);
            write({
                type: 'tools',
                tool_used: this.primaryTool(toolResults),
            });
            const memPrefix = await this.memory.formatPromptPrefix(auth, dto.sessionId);
            const contextString = memPrefix +
                this.contextBuilder.buildContextString(detected.intent, toolResults, auth.tenantId);
            const { systemPrompt, userMessage } = this.renderPrompt(detected, dto.input, contextString);
            const isListingStream = Boolean(params.isListingQuery);
            const streamModel = this.modelForIntent(detected.intent, isListingStream);
            const streamUseJson = this.expectsStructuredJsonAnswer(detected.intent, params);
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
            const streamShaped = this.finalizeUserFacingReply(full, detected.intent, detected.language, params);
            const response = streamShaped.response;
            let finalStreamStructured = null;
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
        }
        catch (err) {
            let msg;
            let code = 'STREAM_ERROR';
            if (err instanceof common_1.HttpException) {
                const body = err.getResponse();
                if (typeof body === 'object' && body !== null && 'message' in body) {
                    const rawMsg = body.message;
                    msg = Array.isArray(rawMsg)
                        ? rawMsg.join(', ')
                        : String(rawMsg ?? err.message);
                    const c = body.code;
                    if (c)
                        code = c;
                }
                else {
                    msg = typeof body === 'string' ? body : err.message;
                }
            }
            else if (err instanceof Error) {
                msg = err.message || 'Copilot stream failed';
                if (err.name === 'EmptyError' ||
                    msg.includes('no elements in sequence')) {
                    msg =
                        'انقطع تدفق الرد من خدمة الذكاء الاصطناعي — قد تكون الحصة منتهية. حاول بعد قليل.';
                    code = 'AI_STREAM_EMPTY';
                }
            }
            else {
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
    modelForIntent(intent, isListing = false) {
        const override = this.config.get('GEMINI_MODEL')?.trim();
        if (override)
            return override;
        void intent;
        void isListing;
        return 'gemini-3.1-flash-lite-preview';
    }
    maxTokensForAnswer(intent) {
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
    expectsStructuredJsonAnswer(intent, params) {
        if (intent === 'general')
            return false;
        if (intent === 'scheduling' && params.isListingQuery === true)
            return false;
        return true;
    }
    finalizeUserFacingReply(raw, intent, language, params) {
        if (intent === 'general') {
            return { response: this.formatAssistantReply(raw), structuredData: null };
        }
        if (intent === 'scheduling' && params.isListingQuery === true) {
            const t = raw.trim() || '—';
            return { response: t, structuredData: null };
        }
        return this.presenter.composeFromLlmJson(raw, intent, { language });
    }
    renderPrompt(detected, input, contextString) {
        const clinicPhone = this.config.get('CLINIC_PHONE')?.trim() || '(clinic phone)';
        const vars = {
            input,
            context: contextString,
            current_date: (0, copilot_params_builder_1.clinicCalendarToday)(),
            clinic_phone: clinicPhone,
        };
        const promptTemplate = detected.intent === 'scheduling'
            ? prompt_library_1.PromptLibrary.selectSchedulingPrompt(input)
            : prompt_library_1.PromptLibrary.getDefaultForIntent(detected.intent);
        if (!promptTemplate) {
            const general = prompt_library_1.PromptLibrary.getGeneralAssistantPrompt();
            return prompt_library_1.PromptLibrary.render({ id: 'general', system: general.systemPrompt, user: general.userMessage }, vars);
        }
        return prompt_library_1.PromptLibrary.render(promptTemplate, vars);
    }
    formatAssistantReply(raw) {
        return (0, copilot_response_composer_1.extractPrimaryAssistantText)(raw);
    }
    primaryTool(results) {
        const successful = results.find((r) => !r.error);
        return successful?.tool ?? null;
    }
    attachToolMetadata(detected, toolResults) {
        return {
            intent_confidence: detected.confidence,
            tools_executed: toolResults.map((t) => t.tool),
        };
    }
    async persistMemory(dto, auth, detected, params, toolResults) {
        await this.memory.remember(auth, {
            lastInput: dto.input.slice(0, 500),
            lastIntent: detected.intent,
            lastPatientId: params.patientId != null ? String(params.patientId) : undefined,
            lastDoctorId: params.doctorId != null ? String(params.doctorId) : undefined,
            lastToolSummary: this.memory.digestToolsSummary(detected.intent, toolResults.map((t) => t.tool)),
        }, dto.sessionId);
    }
    async processSearchIntent(dto, auth, detected, startedAt) {
        const clinicPhone = this.config.get('CLINIC_PHONE')?.trim() || '(clinic phone)';
        const rendered = prompt_library_1.PromptLibrary.render(prompt_library_1.PromptLibrary.search.naturalLanguageQueryConverter, {
            input: dto.input,
            context: '',
            current_date: (0, copilot_params_builder_1.clinicCalendarToday)(),
            clinic_phone: clinicPhone,
        });
        let parsedNl;
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
            const raw = this.reasoning.parseJson(nlResponse.text);
            const sp = (0, search_nl_plan_schema_1.safeParseNlSearchPlan)(raw);
            if (!sp.success) {
                throw new Error('nl_plan_invalid');
            }
            parsedNl = sp.data;
        }
        catch {
            parsedNl = this.nlSearchHeuristicPlan(dto);
            nlModel = 'fallback-heuristic';
        }
        const args = (0, search_tool_args_1.normalizeSearchToolArgs)(parsedNl.tool, parsedNl.filters ?? {});
        const primaryPlans = [
            {
                tool: parsedNl.tool,
                args,
                reason: 'nl_search_plan_validated',
            },
        ];
        let toolResults = await this.execution.execute(auth, primaryPlans);
        if (toolResults.every((r) => r.error)) {
            toolResults = await this.execution.execute(auth, this.buildSearchFallbackToolPlans(dto, detected));
        }
        const primary = toolResults.find((r) => !r.error) ?? toolResults[0];
        const rows = primary?.data;
        const count = Array.isArray(rows) ? rows.length : rows != null ? 1 : 0;
        const displayQ = parsedNl.display_query?.trim() ||
            dto.input.trim() ||
            (detected.language === 'ar' ? 'البحث' : 'search');
        const response = this.presenter.buildSearchNarrative(primary?.tool, primary?.data, primary?.error, displayQ, detected.language);
        const confidenceMeta = parsedNl.confidence != null
            ? String(parsedNl.confidence)
            : detected.confidence;
        const structured_data = {
            nl_plan: parsedNl,
            result_count: count,
            results_preview: Array.isArray(rows) ? rows.slice(0, 15) : rows,
            tools_executed: toolResults.map((t) => t.tool),
        };
        await this.memory.remember(auth, {
            lastInput: dto.input.slice(0, 500),
            lastIntent: 'search',
            lastToolSummary: this.memory.digestToolsSummary('search', toolResults.map((t) => t.tool)),
        }, dto.sessionId);
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
    nlSearchHeuristicPlan(dto) {
        const looksUnpaid = /ما دفع|لم يدفع|غير مدفوع|بدون دفع|unpaid|متأخر/i.test(dto.input);
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
    buildSearchFallbackToolPlans(dto, detected) {
        const params = (0, copilot_params_builder_1.resolveToolParams)(dto, detected);
        const tools = this.toolRegistry.getSearchToolsForFallbackParams(params);
        return tools.map((tool) => ({
            tool,
            args: (0, search_tool_args_1.normalizeSearchToolArgs)(tool, (0, search_tool_args_1.paramsToSearchFilters)(tool, params)),
            reason: 'search_keyword_fallback',
        }));
    }
};
exports.CopilotService = CopilotService;
exports.CopilotService = CopilotService = CopilotService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [intent_detector_service_1.IntentDetectorService,
        copilot_execution_engine_1.CopilotExecutionEngine,
        copilot_memory_service_1.CopilotMemoryService,
        copilot_reasoning_service_1.CopilotReasoningService,
        copilot_presenter_service_1.CopilotPresenterService,
        tool_registry_service_1.ToolRegistryService,
        context_builder_service_1.ContextBuilderService,
        config_1.ConfigService])
], CopilotService);
//# sourceMappingURL=copilot.service.js.map