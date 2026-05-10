/** Optional machine-readable tail for actionable notifications (no DB migration). */
export const MF_JSON_SEP = '|||MF_JSON|||';

export type NotificationActionMeta = 'checkin' | 'send_to_doctor' | 'dismiss';

export function packNotificationMessage(
  text: string,
  meta?: { appointmentId?: string; actions?: NotificationActionMeta[] },
): string {
  if (!meta || (!meta.appointmentId && !meta.actions?.length)) return text;
  return `${text}${MF_JSON_SEP}${JSON.stringify(meta)}`;
}

export function unpackNotificationMessage(message: string): {
  text: string;
  meta: { appointmentId?: string; actions?: NotificationActionMeta[] } | null;
} {
  const idx = message.indexOf(MF_JSON_SEP);
  if (idx === -1) return { text: message, meta: null };
  const text = message.slice(0, idx);
  try {
    const meta = JSON.parse(message.slice(idx + MF_JSON_SEP.length)) as {
      appointmentId?: string;
      actions?: NotificationActionMeta[];
    };
    return { text, meta: meta && typeof meta === 'object' ? meta : null };
  } catch {
    return { text: message, meta: null };
  }
}
