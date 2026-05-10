import { ConfigService } from '@nestjs/config';
import { LlmGatewayService } from '../llm/llm-gateway.service';
import type { DetectedIntent } from './intent.types';
export declare class IntentDetectorService {
    private readonly llm;
    private readonly config;
    private readonly logger;
    constructor(llm: LlmGatewayService, config: ConfigService);
    detect(input: string): Promise<DetectedIntent>;
}
