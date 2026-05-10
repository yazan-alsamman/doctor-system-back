import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { ParseBookingDto } from './dto/parse-booking.dto';
declare const RawResultSchema: z.ZodObject<{
    patient: z.ZodString;
    doctorId: z.ZodString;
    doctorName: z.ZodString;
    day: z.ZodNumber;
    dayLabel: z.ZodString;
    start: z.ZodNumber;
    duration: z.ZodNumber;
    reason: z.ZodString;
    visitType: z.ZodOptional<z.ZodString>;
    urgent: z.ZodBoolean;
    conf: z.ZodObject<{
        patient: z.ZodEnum<{
            high: "high";
            medium: "medium";
            low: "low";
        }>;
        doctor: z.ZodEnum<{
            high: "high";
            medium: "medium";
            low: "low";
        }>;
        day: z.ZodEnum<{
            high: "high";
            medium: "medium";
            low: "low";
        }>;
        time: z.ZodEnum<{
            high: "high";
            medium: "medium";
            low: "low";
        }>;
        reason: z.ZodEnum<{
            high: "high";
            medium: "medium";
            low: "low";
        }>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type BookingParseResult = z.infer<typeof RawResultSchema>;
export declare class GeminiBookingService {
    private readonly config;
    private readonly logger;
    constructor(config: ConfigService);
    parseNaturalLanguageBooking(input: ParseBookingDto): Promise<BookingParseResult>;
    private parseJsonLoose;
    private normalizeResult;
}
export {};
