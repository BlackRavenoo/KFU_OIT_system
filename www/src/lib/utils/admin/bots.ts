import { loadItems, createItem, deleteItem } from '$lib/utils/admin/api-handlers';
import { notification, NotificationType } from '$lib/utils/notifications/notification';

const BOTS_ENDPOINT = '/api/v1/bots';

export interface Bot {
    id: string;
    name: string;
    token: string;
    active: boolean;
}

export interface BotsState {
    bots: Bot[];
    loading: boolean;
    error: boolean;
    totalPages: number;
}

export interface CreateBotData {
    name: string;
}

/**
 * Загрузка списка ботов
 */
export async function loadBotsData(
    currentPage: number,
    itemsPerPage: number,
    searchQuery: string
): Promise<BotsState> {
    const result = await loadItems({
        endpoint: BOTS_ENDPOINT,
        currentPage,
        itemsPerPage,
        searchQuery,
        errorMessage: 'Ошибка при загрузке ботов'
    });

    return {
        bots: result.items as Bot[],
        totalPages: result.totalPages,
        error: result.error,
        loading: false
    };
}

/**
 * Создание нового бота
 */
export async function createBotData(data: CreateBotData): Promise<boolean> {
    if (!data.name.trim()) {
        notification('Введите имя бота', NotificationType.Error);
        return false;
    }

    const result = await createItem({
        endpoint: BOTS_ENDPOINT,
        data,
        successMessage: 'Бот успешно создан',
        errorMessage: 'Ошибка при создании бота'
    });

    return result.success;
}

/**
 * Удаление бота
 */
export async function deleteBotData(id: string): Promise<boolean> {
    return await deleteItem({
        endpoint: BOTS_ENDPOINT,
        id,
        successMessage: 'Бот успешно удален',
        errorMessage: 'Ошибка при удалении бота'
    });
}

/**
 * Копирование токена в буфер обмена
 */
export async function copyTokenToClipboard(token: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(token);
        notification('Токен скопирован в буфер обмена', NotificationType.Success);
        return true;
    } catch (err) {
        notification('Не удалось скопировать токен', NotificationType.Error);
        return false;
    }
}