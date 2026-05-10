import { GeminiBookingService } from './gemini-booking.service';
import type { ParseBookingDto } from './dto/parse-booking.dto';
export declare class AiController {
    private readonly geminiBooking;
    constructor(geminiBooking: GeminiBookingService);
    parseBooking(body: ParseBookingDto): Promise<{
        patient: string;
        doctorId: string;
        doctorName: string;
        day: number;
        dayLabel: string;
        start: number;
        duration: number;
        reason: string;
        urgent: boolean;
        conf: {
            patient: "high" | "medium" | "low";
            doctor: "high" | "medium" | "low";
            day: "high" | "medium" | "low";
            time: "high" | "medium" | "low";
            reason: "high" | "medium" | "low";
        };
        visitType?: string | undefined;
    }>;
}
