import { AppointmentStatus } from "@prisma/client";
export declare function assertValidTransition(from: AppointmentStatus, to: AppointmentStatus): void;
