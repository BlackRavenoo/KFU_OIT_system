import { api } from '$lib/utils/api';
import { notification } from '$lib/utils/notifications/notification';
import { NotificationType } from '$lib/utils/notifications/types';

const ADMIN_TRANSFER_ENDPOINT = '/api/v1/user/admin/transfer';
const ADMIN_TRANSFER_VALIDATE_ENDPOINT = '/api/v1/auth/admin_transfer/validate';
const ADMIN_TRANSFER_CONFIRM_ENDPOINT = '/api/v1/auth/admin_transfer/confirm';

export interface AdminTransferValidateResponse {
    from_user_id: number;
    to_user_id: number;
}

/**
 * Валидирует токен передачи прав без его потребления.
 * @param token - токен из URL
 * @returns {Promise<AdminTransferValidateResponse|null>} - данные о передаче прав или null, если токен недействителен
 */
export async function validateAdminTransferToken(token: string): Promise<AdminTransferValidateResponse | null> {
    try {
        const response = await api.post<AdminTransferValidateResponse>(ADMIN_TRANSFER_VALIDATE_ENDPOINT, { token });
        return response.success ? (response.data ?? null) : null;
    } catch {
        return null;
    }
}

/**
 * Подтверждает передачу прав администратора (одноразовый токен).
 * @param token - токен из URL
 * @returns {Promise<boolean>} - результат подтверждения (успех или ошибка)
 */
export async function confirmAdminTransfer(token: string): Promise<boolean> {
    try {
        const response = await api.post(ADMIN_TRANSFER_CONFIRM_ENDPOINT, { token });
        if (response.success) {
            notification('Права администратора успешно переданы', NotificationType.Success);
            return true;
        } else {
            notification('Ошибка при подтверждении передачи прав', NotificationType.Error);
            return false;
        }
    } catch {
        notification('Ошибка при подтверждении передачи прав', NotificationType.Error);
        return false;
    }
}

/**
 * Отправляет запрос на передачу прав администратора другому пользователю.
 * На email целевого пользователя будет отправлено письмо с подтверждением.
 * @param userId - ID пользователя, которому передаются права
 * @returns {Promise<boolean>} - результат отправки запроса (успех или ошибка)
 */
export async function requestAdminTransfer(userId: string): Promise<boolean> {
    try {
        const response = await api.post(ADMIN_TRANSFER_ENDPOINT, { user_id: parseInt(userId) });

        if (response.success) {
            notification('Запрос на передачу прав отправлен. Пользователь получит письмо с подтверждением.', NotificationType.Success);
            return true;
        } else {
            notification('Ошибка при отправке запроса на передачу прав', NotificationType.Error);
            return false;
        }
    } catch {
        notification('Ошибка при отправке запроса на передачу прав', NotificationType.Error);
        return false;
    }
}
