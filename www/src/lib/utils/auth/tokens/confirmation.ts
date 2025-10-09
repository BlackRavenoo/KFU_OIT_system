import { api } from '$lib/utils/api';

/**
 * Проверка токена на валидность
 * @param token Токен подтверждения регистрации
*/
export async function checkConfirmationToken(token: string): Promise<boolean> {
    const res = await api.post<{ valid: boolean }>('/api/v1/auth/validate', { token });
    return res.success;
}