import { api } from '$lib/utils/api';
import { notification, NotificationType } from '$lib/utils/notifications/notification';

/**
 * Общая функция для загрузки данных с пагинацией и поиском
 */
export async function loadItems<T>({
    endpoint,
    currentPage = 1,
    itemsPerPage = 10,
    searchQuery = '',
    errorMessage = 'Ошибка при загрузке данных'
}: {
    endpoint: string;
    currentPage?: number;
    itemsPerPage?: number;
    searchQuery?: string;
    errorMessage?: string;
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
            search: searchQuery?.trim() || undefined
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