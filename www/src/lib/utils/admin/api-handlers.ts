import { api } from '$lib/utils/api';
import { notification } from '$lib/utils/notifications/notification';
import { NotificationType } from '$lib/utils/notifications/types';
import type { UserRole } from '../auth/types';

/**
 * Общая функция для загрузки данных с пагинацией и поиском
 * @param endpoint - API endpoint для загрузки данных
 * @param currentPage - текущая страница (по умолчанию 1)
 * @param itemsPerPage - количество элементов на странице (по умолчанию 10)
 * @param searchQuery - строка для поиска (по умолчанию пустая)
 * @param errorMessage - сообщение об ошибке при загрузке данных
 * @param minimal_role - минимальная роль пользователя для доступа к данным
 * @returns объект с массивом элементов, количеством страниц и флагом ошибки
 */
export async function loadItems<T>({
    endpoint,
    currentPage = 1,
    itemsPerPage = 10,
    searchQuery = '',
    errorMessage = 'Ошибка при загрузке данных',
    minimal_role = undefined
}: {
    endpoint: string;
    currentPage?: number;
    itemsPerPage?: number;
    searchQuery?: string;
    errorMessage?: string;
    minimal_role?: UserRole | undefined;
}): Promise<{
    items: T[];
    totalPages: number;
    error: boolean;
}> {
    let items: T[] = [];
    let totalPages = 1;
    let error = false;

    try {
        const response = await api.get(endpoint, {
            page: currentPage,
            page_size: itemsPerPage,
            search: searchQuery?.trim() || undefined,
            ...(minimal_role !== undefined && { minimal_role })
        });

        if (response.success) {
            if (response.data && typeof response.data === 'object') {
                if ('items' in response.data && 'max_page' in response.data) {
                    items = (response.data as { items: T[]; max_page: number }).items || [];
                    totalPages = (response.data as { items: T[]; max_page: number }).max_page || 1;
                } else if (Array.isArray(response.data)) {
                    items = response.data;
                    totalPages = 1;
                } else {
                    error = true;
                    notification(errorMessage, NotificationType.Error);
                }
            } else {
                error = true;
                notification(errorMessage, NotificationType.Error);
            }
        } else {
            if (response.status === 404) {
                items = [];
                totalPages = 1;
            } else if (response.status === 0) {
                error = true;
            } else {
                error = true;
                notification(errorMessage, NotificationType.Error);
            }
        }
    } catch (err: any) {
        if (err?.status === 404 || 
        err?.response?.status === 404 || 
        (err?.message && (err.message.includes('404') || err.message.includes('not found')))) {
            items = [];
            totalPages = 1;
        } else {
            error = true;
        }
    }

    return { items, totalPages, error };
}

/**
 * Общая функция для создания элемента
 * @param endpoint - API endpoint для создания элемента
 * @param data - данные для создания элемента
 * @param successMessage - сообщение об успешном создании элемента
 * @param errorMessage - сообщение об ошибке при создании элемента
 * @returns объект с флагом успеха и данными созданного элемента (если успешно)
 */
export async function createItem<T>({
    endpoint,
    data,
    successMessage = 'Успешно создано',
    errorMessage = 'Ошибка при создании'
}: {
    endpoint: string;
    data: Record<string, any>;
    successMessage?: string;
    errorMessage?: string;
}): Promise<{
    success: boolean;
    data?: T;
}> {
    try {
        const response = await api.post(endpoint, data);

        if (response.success) {
            notification(successMessage, NotificationType.Success);
            return { success: true, data: response.data as T };
        } else {
            notification(response.error || errorMessage, NotificationType.Error);
            return { success: false };
        }
    } catch (err) {
        notification(errorMessage, NotificationType.Error);
        return { success: false };
    }
}

/**
 * Общая функция для удаления элемента
 * @param endpoint - API endpoint для удаления элемента
 * @param id - идентификатор элемента для удаления
 * @param successMessage - сообщение об успешном удалении элемента
 * @param errorMessage - сообщение об ошибке при удалении элемента
 * @returns флаг успеха удаления
 */
export async function deleteItem({
    endpoint,
    id,
    successMessage = 'Успешно удалено',
    errorMessage = 'Ошибка при удалении'
}: {
    endpoint: string;
    id: string | number;
    successMessage?: string;
    errorMessage?: string;
}): Promise<boolean> {
    try {
        const response = await api.delete(`${endpoint}/${id}`);

        if (response.success) {
            notification(successMessage, NotificationType.Success);
            return true;
        } else {
            notification(errorMessage, NotificationType.Error);
            return false;
        }
    } catch (err) {
        notification(errorMessage, NotificationType.Error);
        return false;
    }
}