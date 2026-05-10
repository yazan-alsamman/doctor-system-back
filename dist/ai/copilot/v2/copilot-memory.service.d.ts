import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthContext } from '../../../common/auth-context';
import type { IntentType } from '../intent/intent.types';
import type { CopilotMemorySnapshot } from './copilot-v2.types';
export declare class CopilotMemoryService implements OnModuleInit, OnModuleDestroy {
    private readonly config;
    private readonly logger;
    private readonly local;
    private redis;
    private readonly ttlSec;
    constructor(config: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private key;
    private redisStorageKey;
    private safeSessionSegment;
    get(auth: AuthContext, sessionId?: string): Promise<CopilotMemorySnapshot | undefined>;
    remember(auth: AuthContext, patch: Partial<Omit<CopilotMemorySnapshot, 'updatedAt'>>, sessionId?: string): Promise<void>;
    formatPromptPrefix(auth: AuthContext, sessionId?: string): Promise<string>;
    digestToolsSummary(intent: IntentType, toolNames: string[]): string;
    private parseSnapshot;
}
