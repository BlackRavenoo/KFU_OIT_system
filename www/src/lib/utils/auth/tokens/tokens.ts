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
        if (!checkTokenExpiration(tokens.accessToken)) 
            throw new Error('Access token is expired or invalid');

        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Проверка валидности токена доступа.
 * @returns {boolean} true, если токен действителен, иначе false.
 */
async function checkTokenExpiration(token: string): Promise<boolean> {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp = payload.exp * 1000;
        
        if (Date.now() >= exp) {
            logout();
            return false;
        } 
        
        if (exp - Date.now() < 5 * 60 * 1000) {
            const tokens = getAuthTokens();
            if (tokens?.refreshToken) {
                const isRefreshed = await refreshAuthTokens();
                return isRefreshed;
            }
            return true;
        }
        
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
