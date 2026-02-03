import { api } from '$lib/utils/api';
import type { ApiResponse } from '$lib/utils/api';
import type { SystemNotification, CreateSystemNotificationParams, UpdateSystemNotificationParams } from './types';

/**
 * Получить системные уведомления
 * @return {Promise<ApiResponse<SystemNotification[]>>} Список системных уведомлений
 */
export async function getSystemNotifications(): Promise<ApiResponse<SystemNotification[]>> {
    return api.get<SystemNotification[]>('/api/v1/system_notifications');
}

/**
 * Создать системное уведомление
 * @param {CreateSystemNotificationParams} data Данные для создания уведомления
 * @return {Promise<ApiResponse<void>>} Результат создания уведомления
 */
export async function createSystemNotification(data: CreateSystemNotificationParams): Promise<ApiResponse<void>> {
    return api.post('/api/v1/system_notifications', data);
}

/**
 * Удалить системное уведомление
 * @param {number} id ID уведомления
 * @return {Promise<ApiResponse<void>>}
 */
export async function deleteSystemNotification(id: number): Promise<ApiResponse<void>> {
    return api.delete(`/api/v1/system_notifications/${id}`);
}

/**
 * Обновить системное уведомление
 * @param {number} id ID уведомления
 * @param {UpdateSystemNotificationParams} data Данные для обновления
 * @return {Promise<ApiResponse<void>>}
 */
export async function updateSystemNotification(id: number, data: UpdateSystemNotificationParams): Promise<ApiResponse<void>> {
    return api.put(`/api/v1/system_notifications/${id}`, data);
}