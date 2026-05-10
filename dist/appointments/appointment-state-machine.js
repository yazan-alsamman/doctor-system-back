"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertValidTransition = assertValidTransition;
const client_1 = require("@prisma/client");
const common_1 = require("@nestjs/common");
const FORWARD_FLOW = {
    scheduled: ['confirmed', 'arrived', 'no_show'],
    confirmed: ['arrived', 'no_show'],
    arrived: ['in_consultation'],
    in_consultation: ['completed'],
    completed: ['paid'],
    paid: [],
    no_show: [],
    cancelled: [],
};
const CANCELLABLE_STATUSES = new Set([
    client_1.AppointmentStatus.scheduled,
    client_1.AppointmentStatus.confirmed,
    client_1.AppointmentStatus.arrived,
]);
function assertValidTransition(from, to) {
    if (from === to)
        return;
    if (to === client_1.AppointmentStatus.cancelled) {
        if (!CANCELLABLE_STATUSES.has(from)) {
            throw new common_1.BadRequestException({
                message: `Cannot cancel an appointment that is already '${from}'. Use a refund flow instead.`,
                code: 'INVALID_APPOINTMENT_TRANSITION',
                status: 400,
            });
        }
        return;
    }
    if (!FORWARD_FLOW[from]?.includes(to)) {
        throw new common_1.BadRequestException({
            message: `Invalid appointment transition: ${from} → ${to}`,
            code: 'INVALID_APPOINTMENT_TRANSITION',
            status: 400,
        });
    }
}
//# sourceMappingURL=appointment-state-machine.js.map