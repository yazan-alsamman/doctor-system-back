import type { AuthContext } from '../../common/auth-context';
import type { Response } from 'express';
import { CopilotService } from './copilot.service';
import type { CopilotRequestDto } from './dto/copilot-request.dto';
export declare class CopilotController {
    private readonly copilot;
    constructor(copilot: CopilotService);
    stream(dto: CopilotRequestDto, auth: AuthContext, res: Response): Promise<void>;
    ask(dto: CopilotRequestDto, auth: AuthContext): Promise<import("./copilot.service").CopilotResponse>;
    health(): {
        status: string;
        service: string;
    };
}
