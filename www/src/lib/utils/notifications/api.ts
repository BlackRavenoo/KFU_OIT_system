import api from '../api';
import type { UserNotification, GetUserNotificationsParams } from './types';

/**
 * Функция для получения количества непрочитанных уведомлений пользователя
 * @returns {Promise<number>} Число непрочитанных уведомлений пользователя
 */
export async function getUserNotificationsCount() {
    return (await api.get<{ count: number }>('/api/v1/notifications/count')).data.count;
}

/**
 * Функция для получения списка уведомлений пользователя
 * @param params - параметры фильтрации (before, after, limit)
 * @returns {Promise<UserNotification[]>} Массив уведомлений пользователя
 */
export async function getUserNotifications(params?: GetUserNotificationsParams) {
    const body = params ? params : { limit: 20 };
    return (await api.get<UserNotification[]>('/api/v1/notifications', { params: body })).data;
}

export async function markUserNotificationsAsRead(ticket_id: Array<number>) {
    return (await api.post('/api/v1/notifications/read', { ticket_ids: ticket_id })).data;
}