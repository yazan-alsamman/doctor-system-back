"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateScheduleSchema = void 0;
const zod_1 = require("zod");
exports.CreateScheduleSchema = zod_1.z.object({
    doctorId: zod_1.z.string().min(1),
    dayOfWeek: zod_1.z.number().int().min(0).max(6),
    startTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
    endTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
    breakStart: zod_1.z.string().regex(/^\d{2}:\d{2}$/).optional(),
    breakEnd: zod_1.z.string().regex(/^\d{2}:\d{2}$/).optional(),
});
//# sourceMappingURL=create-schedule.dto.js.map