export declare const MF_JSON_SEP = "|||MF_JSON|||";
export type NotificationActionMeta = 'checkin' | 'send_to_doctor' | 'dismiss';
export declare function packNotificationMessage(text: string, meta?: {
    appointmentId?: string;
    actions?: NotificationActionMeta[];
}): string;
export declare function unpackNotificationMessage(message: string): {
    text: string;
    meta: {
        appointmentId?: string;
        actions?: NotificationActionMeta[];
    } | null;
};
