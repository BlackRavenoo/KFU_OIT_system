import { loadItems, createItem, deleteItem } from '$lib/utils/admin/api-handlers';
import { notification, NotificationType } from '$lib/utils/notifications/notification';

const USER_LIST_ENDPOINT = '/api/v1/user/list';
const USER_INVITE_ENDPOINT = '/api/v1/user/admin/invite';
const USER_DELETE_ENDPOINT = '/api/v1/admin/users';

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
 * Удаление пользователя
 */
export async function deleteUserData(userId: string): Promise<boolean> {
    return await deleteItem({
        endpoint: USER_DELETE_ENDPOINT,
        id: userId,
        successMessage: 'Пользователь успешно удален',
        errorMessage: 'Ошибка при удалении пользователя'
    });
}