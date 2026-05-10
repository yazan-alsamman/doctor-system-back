import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthContext } from '../../common/auth-context';
import type { Response } from 'express';
import { CopilotService } from './copilot.service';
import { CopilotRequestSchema } from './dto/copilot-request.dto';
import type { CopilotRequestDto } from './dto/copilot-request.dto';

@Controller('ai/copilot')
@UseGuards(JwtAuthGuard)
export class CopilotController {
  constructor(private readonly copilot: CopilotService) {}

  /**
   * Streaming copilot — NDJSON lines (`intent`, `tools`, `chunk`, `done`, `error`).
   * Final answer text may duplicate streamed chunks; client should prefer `done.response`.
   */
  @Post('stream')
  @UsePipes(new ZodValidationPipe(CopilotRequestSchema))
  async stream(
    @Body() dto: CopilotRequestDto,
    @CurrentUser() auth: AuthContext,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Call flushHeaders on the object directly — storing it in a variable loses `this` binding
    const r = res as Response & { flushHeaders?: () => void };
    if (typeof r.flushHeaders === 'function') r.flushHeaders();
    await this.copilot.processStream(dto, auth, res);
  }

  /**
   * Main copilot endpoint — receives natural language input and returns
   * a structured AI response with intent, tool data, and actionable suggestions.
   *
   * The AI NEVER modifies data. All suggestions must be confirmed and
   * executed via the appropriate domain endpoints.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(CopilotRequestSchema))
  ask(@Body() dto: CopilotRequestDto, @CurrentUser() auth: AuthContext) {
    return this.copilot.process(dto, auth);
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'MediFlow AI Copilot' };
  }
}
