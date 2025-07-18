/**
 * @file auth.ts
 * Модуль для управления авторизацией пользователей.
 * Содержит функции для входа, выхода, проверки токенов и получения данных пользователя.
 * Использует Svelte store для хранения состояния авторизации и данных пользователя.
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { browser } from '$app/environment';
import { error } from '@sveltejs/kit';
import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

const AUTH_BASE_PATH = '/api/v1/auth';
let tokenStore: AuthTokens | null = null;
let initialAuthState = false;
let initialUserData = null;

export const tokens = createTokenStore();
export const currentUser = writable<UserData | null>(initialUserData);
export const isAuthenticated = writable<boolean>(initialAuthState);

/**
 * Попытка восстановить состояние авторизации из localStorage
 */
if (browser) {
    try {
        const storedAuth = localStorage.getItem('auth_state');
        const storedUser = localStorage.getItem('auth_user');

        if (storedAuth) initialAuthState = JSON.parse(storedAuth);
        if (storedUser) initialUserData = JSON.parse(storedUser);

    } catch (e) {
        console.error('Ошибка при восстановлении состояния авторизации:', e);
    }
}

if (browser) {
    currentUser.subscribe(value => {
    value ?
        localStorage.setItem('auth_user', JSON.stringify(value)) :
        localStorage.removeItem('auth_user');
    });

    isAuthenticated.subscribe(value => {
        localStorage.setItem('auth_state', JSON.stringify(value));
    });
}

/**
 * Создает Svelte store для хранения токенов авторизации.
 * Этот store будет синхронизирован с localStorage,
 * чтобы сохранять состояние между перезагрузками страницы.
 * @returns {Writable<AuthTokens | null>} Svelte store с токенами авторизации.
 */
function createTokenStore(): Writable<AuthTokens | null> {
    const initialTokens = getAuthTokens();
    const store = writable<AuthTokens | null>(initialTokens);
    
    store.subscribe(value => {
        if (value) {
            localStorage.setItem('auth_tokens', JSON.stringify(value));
            tokenStore = value;
        } else {
            localStorage.removeItem('auth_tokens');
            tokenStore = null;
        }
    });
    
    return store;
}

/**
 * Аутентификация пользователя с использованием email и пароля.
 * @param email
 * @param password
 * @param rememberMe Флаг "запомнить меня"
 * @returns {Promise<any>} Ответ сервера с данными пользователя или ошибкой.
 */
export async function login(email: string, password: string, rememberMe: boolean = false): Promise<any> {
    try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        const fingerprint = result.visitorId; 
        const requestBody: LoginRequest = {
            email,
            password,
            fingerprint
        };    

        const response = await fetch(`${AUTH_BASE_PATH}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            credentials: 'include'
        });

        if (!response.ok)
            throw new Error(`Login failed: ${response.status}`);   

        const data = await response.json();

        if (data.access_token) {
            tokens.set({
                accessToken: data.access_token,
                refreshToken: rememberMe ? data.refresh_token : undefined
            });
        }

        return data;
    } catch (error) {
        throw error;
    }
}

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
 * Обновляет токены авторизации через refresh_token.
 * @returns {Promise<boolean>} true, если токены успешно обновлены, иначе false.
 */
export async function refreshAuthTokens(): Promise<boolean> {
    try {
        const tokensData = getAuthTokens();
        if (!tokensData?.refreshToken) return false;

        const fp = await FingerprintJS.load();
        const result = await fp.get();
        const fingerprint = result.visitorId;

        const response = await fetch('/api/v1/auth/refresh_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                refresh_token: tokensData.refreshToken,
                fingerprint
            }),
            credentials: 'include'
        });

        if (!response.ok) return false;

        const data = await response.json();

        if (data.access_token && data.refresh_token) {
            tokens.set({
                accessToken: data.access_token,
                refreshToken: data.refresh_token
            });
            return true;
        }

        return false;
    } catch (error) {
        logout();
        return false;
    }
}

/**
 * Получение данных текущего пользователя.
 * @returns {Promise<any>} Данные пользователя или ошибка.
 */
export async function getUserData(): Promise<UserData> {
    try {
        const response = await fetch(`${AUTH_BASE_PATH}/me`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'authorization': `Bearer ${getAuthTokens()?.accessToken}`
            },
            credentials: 'include'
        });

        if (!response.ok)
            throw new Error(`Failed to fetch user data: ${response.status}`);

        const data = await response.json();
        return data;
    } catch (error) {
        throw error;
    }
}

/**
 * Выход пользователя из системы.
 * @returns {Promise<any>} Ответ сервера со статусом операции.
 */
export async function logout(): Promise<void> {
    try {
        clearAuthTokens();
        
        isAuthenticated.set(false);
        currentUser.set(null);
        
        const currentPath = window.location.pathname;
        if (currentPath !== '/' && currentPath !== '')
            window.location.href = '/';
    } catch (error) {
        throw error;
    }
}

/**
* Возвращает текущие токены авторизации
* @returns {AuthTokens | null} Токены или null, если пользователь не авторизован
*/
export function getAuthTokens(): AuthTokens | null {
    if (!tokenStore) {
        try {
            const storedTokens = localStorage.getItem('auth_tokens');
            if (storedTokens) {
                const parsed = JSON.parse(storedTokens);
                if (parsed && parsed.accessToken)
                    tokenStore = parsed;
                else
                    localStorage.removeItem('auth_tokens');
            }
        } catch (error) {
            localStorage.removeItem('auth_tokens');
        }
    }
    return tokenStore;
}

/**
* Очищает сохраненные токены при выходе пользователя
*/
export function clearAuthTokens(): void {
    tokenStore = null;
    localStorage.removeItem('auth_tokens');
}