import { Body, Controller, Post, UseGuards, UsePipes } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { GeminiBookingService } from './gemini-booking.service';
import { ParseBookingSchema } from './dto/parse-booking.dto';
import type { ParseBookingDto } from './dto/parse-booking.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly geminiBooking: GeminiBookingService) {}

  @Post('booking-parse')
  @UsePipes(new ZodValidationPipe(ParseBookingSchema))
  parseBooking(@Body() body: ParseBookingDto) {
    return this.geminiBooking.parseNaturalLanguageBooking(body);
  }
}
