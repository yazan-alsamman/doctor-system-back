"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopilotRequestSchema = void 0;
const zod_1 = require("zod");
exports.CopilotRequestSchema = zod_1.z.object({
    input: zod_1.z.string().min(1).max(4000),
    sessionId: zod_1.z.string().uuid().optional(),
    context: zod_1.z
        .object({
        patientId: zod_1.z.string().optional(),
        doctorId: zod_1.z.string().optional(),
        dateRange: zod_1.z
            .object({
            from: zod_1.z.string().optional(),
            to: zod_1.z.string().optional(),
        })
            .optional(),
    })
        .optional(),
});
//# sourceMappingURL=copilot-request.dto.js.map