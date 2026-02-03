import { loadItems, createItem } from '$lib/utils/admin/api-handlers';
import { notification } from '$lib/utils/notifications/notification';
import { NotificationType } from '$lib/utils/notifications/types';
import { api } from '$lib/utils/api';
import { validateEmail } from '$lib/utils/validation/validate'
import { UserStatus } from '$lib/utils/auth/types';

import type { IUserData, UserRole } from '$lib/utils/auth/types';

let marked_id: number = 999999999;

const USER_LIST_ENDPOINT = '/api/v1/user/list';
const USER_INVITE_ENDPOINT = '/api/v1/user/admin/invite';
const USER_ACTIVATE_ENDPOINT = `/api/v1/user/${marked_id}/activate`;
const USER_DEACTIVATE_ENDPOINT = `/api/v1/user/${marked_id}/deactivate`;
const USER_CHANGE_STATUS_ENDPOINT = '/api/v1/user/status';
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
    searchQuery: string,
    minimal_role?: UserRole
): Promise<UsersState> {
    const result = await loadItems({
        endpoint: USER_LIST_ENDPOINT,
        currentPage,
        itemsPerPage,
        searchQuery,
        errorMessage: 'Ошибка при загрузке пользователей',
        minimal_role: minimal_role || undefined
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
        const response = await api.patch(USER_CHANGE_STATUS_ENDPOINT, {
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

/**
 * Функция удаления пользователя
 * @param id - идентификатор удаляемого пользователя
 */
export async function deleteUser(id: number): Promise<boolean> {
    try {
        marked_id = id;
        const response = await api.post(USER_DEACTIVATE_ENDPOINT);

        if (response.success) {
            notification('Пользователь успешно удалён', NotificationType.Success);
            marked_id = 999999999;
            return true;
        } else {
            notification('Ошибка при удалении пользователя', NotificationType.Error);
            marked_id = 999999999;
            return false;
        }
    } catch (error) {
        notification('Ошибка при удалении пользователя', NotificationType.Error);
        marked_id = 999999999;
        return false;
    }
}

/**
 * Функция восстановления помеченного на удаление пользователя
 * @param id  - идентификатор пользователя, которого необходимо восстановить
 */
export async function restoreUser(id: number): Promise<boolean> {
    try {
        marked_id = id;
        const response = await api.post(USER_ACTIVATE_ENDPOINT);

        if (response.success) {
            notification('Пользователь успешно восстановлен', NotificationType.Success);
            marked_id = 999999999;
            return true;
        } else {
            notification('Ошибка при восстановлении пользователя', NotificationType.Error);
            marked_id = 999999999;
            return false;
        }
    } catch (error) {
        notification('Ошибка при восстановлении пользователя', NotificationType.Error);
        marked_id = 999999999;
        return false;
    }
}