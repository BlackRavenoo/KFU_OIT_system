/** Notification Types */
export enum NotificationType {
    Success = 'success',
    Error = 'error',
    Warning = 'warning',
    Info = 'info'
}

/** System Types*/
export interface SystemNotification {
    id: number;
    text: string;
    category: number;
    active_until: string | null;
}

export interface CreateSystemNotificationParams {
    text: string;
    category: number;
    active_until?: string | null;
}

export interface UpdateSystemNotificationParams {
    text?: string;
    category?: number;
    active_until?: string | null;
}

export enum SystemNotificationCategory {
    INFO = 0,
    WARNING = 1
}

/** API Types */
export type UserNotificationPayload = {
    type: UserNotificationType;
    data: Record<string, any>;
};

export interface UserNotification {
    id: number,
    ticket_id: string,
    created_at: string,
    read: boolean,
    payload: UserNotificationPayload,
}

export interface GetUserNotificationsParams {
    before?: number;
    after?: number;
    limit?: number;
}

export enum UserNotificationType {
    NewMessages = 'new_messages',
    StatusChanged = 'status_changed',
    Mention = 'mention'
}

export const UserNotificationTypeText: Record<UserNotificationType, string> = {
    [UserNotificationType.NewMessages]: 'Новые сообщения в вашей заявке',
    [UserNotificationType.StatusChanged]: 'Статус вашей заявки изменён',
    [UserNotificationType.Mention]: 'Вы были упомянуты в заявке'
};