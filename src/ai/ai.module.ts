import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { GeminiBookingService } from './gemini-booking.service';
import { CopilotModule } from './copilot/copilot.module';

@Module({
  imports: [CopilotModule],
  controllers: [AiController],
  providers: [GeminiBookingService],
})
export class AiModule {}
