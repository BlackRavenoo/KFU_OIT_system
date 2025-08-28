import { loadItems, createItem } from '$lib/utils/admin/api-handlers';
import { notification, NotificationType } from '$lib/utils/notifications/notification';
import { api } from '$lib/utils/api';

const USER_LIST_ENDPOINT = '/api/v1/user/list';
const USER_INVITE_ENDPOINT = '/api/v1/user/admin/invite';
const USER_DELETE_ENDPOINT = '/api/v1/user/admin/status';

export interface User {
    id: string;
    name: string;
    email: string;
    role: string;
}

export interface UsersState {
    users: User[];
    totalPages: number;
    error: boolean;
}

/**
 * Загрузка списка пользователей
 * @param currentPage Текущая страница
 * @param itemsPerPage Количество элементов на страницу
 * @param searchQuery Строка поиска
 */
export async function loadUsersData(
    currentPage: number,
    itemsPerPage: number,
    searchQuery: string
): Promise<UsersState> {
    const result = await loadItems({
        endpoint: USER_LIST_ENDPOINT,
        currentPage,
        itemsPerPage,
        searchQuery,
        errorMessage: 'Ошибка при загрузке пользователей'
    });

    return {
        users: result.items as User[],
        totalPages: result.totalPages,
        error: result.error
    };
}

/**
 * Валидация email
 */
export function validateEmail(email: string): boolean {
    if (!email) return false;
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
}

/**
 * Отправка приглашения на email
 * @param email Email для приглашения
 */
export async function sendInvitation(email: string): Promise<boolean> {
    if (!validateEmail(email)) {
        notification('Пожалуйста, введите корректный email', NotificationType.Error);
        return false;
    }

    const result = await createItem({
        endpoint: USER_INVITE_ENDPOINT,
        data: { email },
        successMessage: 'Приглашение успешно отправлено',
        errorMessage: 'Ошибка при отправке приглашения'
    });

    return result.success;
}

/**
 * Удаление пользователя (фактически изменение статуса на 3 - удален)
 * @param userId ID пользователя
 * @returns Успешность операции
 */
export async function deleteUserData(userId: string): Promise<boolean> {
    try {
        const response = await api.patch(USER_DELETE_ENDPOINT, {
            id: userId,
            status: 3
        });
        
        if (response.success) {
            notification('Пользователь успешно удален', NotificationType.Success);
            return true;
        } else {
            notification('Ошибка при удалении пользователя', NotificationType.Error);
            return false;
        }
    } catch (error) {
        notification('Ошибка при удалении пользователя', NotificationType.Error);
        return false;
    }
}