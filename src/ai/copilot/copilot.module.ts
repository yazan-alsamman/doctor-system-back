import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';
import { IntentDetectorService } from './intent/intent-detector.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { ContextBuilderService } from './context/context-builder.service';
import { LlmGatewayService } from './llm/llm-gateway.service';
import { GeminiProvider } from './llm/providers/gemini.provider';
import { CopilotPresenterService } from './copilot-presenter.service';
import { CopilotAuthorizationService } from './v2/copilot-authorization.service';
import { CopilotPolicyService } from './v2/copilot-policy.service';
import { CopilotToolValidatorService } from './v2/copilot-tool-validator.service';
import { CopilotMemoryService } from './v2/copilot-memory.service';
import { CopilotExecutionEngine } from './v2/copilot-execution.engine';
import { CopilotReasoningService } from './v2/copilot-reasoning.service';

@Module({
  imports: [PrismaModule],
  controllers: [CopilotController],
  providers: [
    GeminiProvider,
    LlmGatewayService,
    CopilotReasoningService,
    CopilotPresenterService,
    CopilotPolicyService,
    CopilotAuthorizationService,
    CopilotToolValidatorService,
    CopilotMemoryService,
    CopilotExecutionEngine,
    IntentDetectorService,
    ToolRegistryService,
    ContextBuilderService,
    CopilotService,
  ],
  exports: [CopilotService],
})
export class CopilotModule {}
