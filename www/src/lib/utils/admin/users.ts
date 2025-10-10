import { loadItems, createItem } from '$lib/utils/admin/api-handlers';
import { notification, NotificationType } from '$lib/utils/notifications/notification';
import { api } from '$lib/utils/api';
import { validateEmail } from '$lib/utils/validation/validate'
import { UserStatus } from '$lib/utils/auth/types';

import type { IUserData } from '$lib/utils/auth/types';

const USER_LIST_ENDPOINT = '/api/v1/user/list';
const USER_INVITE_ENDPOINT = '/api/v1/user/admin/invite';
const USER_DELETE_ENDPOINT = '/api/v1/user/status';
const USER_CHANGE_ROLE_ENDPOINT = '/api/v1/user/admin/role';

export interface UsersState {
    users: IUserData[];
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
        users: result.items as IUserData[],
        totalPages: result.totalPages,
        error: result.error
    };
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
 * Смена роли пользователя
 * @param userId - id пользователя для смены
 * @param newRole - новая роль для установки пользователю
 */
export async function changeRole(userId: string, newRole: string): Promise<boolean> {
    try {
        const response = await api.patch(USER_CHANGE_ROLE_ENDPOINT, {
            id: userId,
            role: newRole
        });

        if (response.success) {
            notification('Роль успешно изменена', NotificationType.Success);
            return true;
        } else {
            notification('Ошибка при обновлении роли пользователя', NotificationType.Error);
            return false;
        }
    } catch (error) {
        notification('Ошибка при обновлении роли пользователя', NotificationType.Error);
        return false;
    }
}

/**
 * Установка статуса пользователя
 * @param id - ID пользователя
 * @param status - Новый статус пользователя
 */
export async function setUserStatus(id: number, status: UserStatus): Promise<boolean> {
    try {
        const response = await api.patch(USER_DELETE_ENDPOINT, { 
            id,
            status
        });
        
        if (response.success) {
            return true;
        } else {
            notification('Ошибка при смене статуса', NotificationType.Error);
            return false;
        }
    } catch (error) {
        notification('Ошибка при смене статуса', NotificationType.Error);
        return false;
    }
}