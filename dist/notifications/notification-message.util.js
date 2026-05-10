"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MF_JSON_SEP = void 0;
exports.packNotificationMessage = packNotificationMessage;
exports.unpackNotificationMessage = unpackNotificationMessage;
exports.MF_JSON_SEP = '|||MF_JSON|||';
function packNotificationMessage(text, meta) {
    if (!meta || (!meta.appointmentId && !meta.actions?.length))
        return text;
    return `${text}${exports.MF_JSON_SEP}${JSON.stringify(meta)}`;
}
function unpackNotificationMessage(message) {
    const idx = message.indexOf(exports.MF_JSON_SEP);
    if (idx === -1)
        return { text: message, meta: null };
    const text = message.slice(0, idx);
    try {
        const meta = JSON.parse(message.slice(idx + exports.MF_JSON_SEP.length));
        return { text, meta: meta && typeof meta === 'object' ? meta : null };
    }
    catch {
        return { text: message, meta: null };
    }
}
//# sourceMappingURL=notification-message.util.js.map