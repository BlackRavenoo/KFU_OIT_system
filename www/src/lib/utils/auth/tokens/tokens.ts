/**
 * @file auth.tokens.ts
 * Модуль для управления авторизацией пользователей.
 * Содержит функции для получения, установки и проверки токенов авторизации.
 */

import { refreshAuthTokens, logout } from '../api/api';
import { getTokenStore, setTokenStore } from './storage';

import type { IAuthTokens } from '../types';

/**
 * Функция для проверки валидности токена доступа.
 * @returns {Promise<boolean>} true, если токен действителен, иначе false.
 */
export async function checkToken(): Promise<boolean> {
    try {
        const tokens = getAuthTokens();
        if (!tokens)
            return false;
            
        if (!isTokenValid(tokens.accessToken))
            return false;

        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Проверка валидности токена доступа без обновления.
 */
function isTokenValid(token: string): boolean {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp = payload.exp * 1000;
        
        if (Date.now() >= exp)
            return false;
        
        return true;
    } catch (error) {
        return false;
    }
}

/**
* Возвращает текущие токены авторизации
* @returns {AuthTokens | null} Токены или null, если пользователь не авторизован
*/
export function getAuthTokens(): IAuthTokens | null {
    return getTokenStore();
}

/**
* Очищает сохраненные токены при выходе пользователя
*/
export function clearAuthTokens(): void {
    setTokenStore(null);
}

export { refreshAuthTokens };
