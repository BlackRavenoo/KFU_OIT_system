/**
 * @file auth.api.ts
 * Модуль для управления авторизацией пользователей.
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { writable, get } from 'svelte/store';

import { api } from '$lib/utils/api';
import { getAuthTokens, clearAuthTokens } from '../tokens/tokens';
import { setTokenStore } from '../tokens/storage';
import { currentUser, isAuthenticated } from '../storage/initial';
import { AUTH_API_ENDPOINTS as Endpoints } from './endpoints';
import { isTokenValid } from '$lib/utils/auth/tokens/tokens';
import { notification } from '$lib/utils/notifications/notification';
import { NotificationType } from '$lib/utils/notifications/types';

import type { ILoginRequest, IUserData } from '$lib/utils/auth/types';

let isRefreshing = false;
let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

export const authCheckComplete = writable(false);
let authChecking = false;

const CACHE_KEY_USER_DATA = 'user_data_cache';
const CACHE_TTL_USER_DATA = 15 * 60 * 1000;

/**
 * Парсит время истечения токена из accessToken
 * @param token Токен для проверки
 */
function getTokenExpiration(token: string): number | null {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp ? payload.exp * 1000 : null;
    } catch {
        return null;
    }
}

/**
 * Запускает автообновление токена за 5 минут до истечения
 * @param token Токен для проверки и планирования обновления
 */
function scheduleTokenRefresh(token: string) {
    if (refreshTimeout) {
        clearTimeout(refreshTimeout);
        refreshTimeout = null;
    }

    const exp = getTokenExpiration(token);
    if (!exp) return;

    const now = Date.now();
    const refreshTime = exp - 5 * 60 * 1000;
    
    let delay = refreshTime - now;
    if (delay < 0) delay = 0;
    else if (delay > 2147483647) return;

    refreshTimeout = setTimeout(() => tryRefresh(), delay);
}

/**
 * Пытается обновить токен
 * @param token Текущий токен доступа
 */
export async function tryRefresh() {
    if (isRefreshing) return;
    else {
        isRefreshing = true;
        
        try {
            const refreshed = await refreshAuthTokens();

            if (refreshed) {
                const newToken = getAuthTokens()?.accessToken;
                if (newToken) scheduleTokenRefresh(newToken);
                else {
                    isRefreshing = false;
                    return;
                }
            } else {
                isRefreshing = false;
                return;
            }
        } finally {
            isRefreshing = false;
        }
    }
}

/** 
 * Обновляет токены авторизации через refresh_token.
 */
export async function refreshAuthTokens(): Promise<boolean> {
    const tokensData = getAuthTokens();
    if (!tokensData?.refreshToken) return false;
    
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    const fingerprint = result.visitorId;
    const requestBody = {
        refresh_token: tokensData.refreshToken,
        fingerprint
    };
    
    try {
        const response: { success: boolean; data?: { access_token: string; refresh_token?: string } } = 
            await api.post(Endpoints.refresh, requestBody);
        
        if (response.success && response.data?.access_token && response.data?.refresh_token) {
            setTokenStore({
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token
            });
            
            scheduleTokenRefresh(response.data.access_token);
            return true;
        }
    } catch (error) {
        return false;
    }
    
    return false;
}

/**
 * Выход пользователя из системы.
 */
export async function logout(): Promise<void> {
    try {
        localStorage.removeItem(CACHE_KEY_USER_DATA);
    } catch {
        console.warn('Не удалось очистить кеш пользователя');
    }

    clearAuthTokens();

    if (refreshTimeout) {
        clearTimeout(refreshTimeout);
        refreshTimeout = null;
    }
    
    isRefreshing = false;
    
    isAuthenticated.set(false);
    currentUser.set(null);

    window.removeEventListener('visibilitychange', onVisibilityOrFocus);
    window.removeEventListener('focus', onVisibilityOrFocus);
    visibilityHandlerSet = false;
    window.location.href = '/';
}

/**
 * Аутентификация пользователя с использованием email и пароля.
 * @param login Логин или почта пользователя
 * @param password Пароль
 * @param rememberMe Флаг "запомнить меня"
 * @returns {Promise<any>} Ответ сервера с данными пользователя или ошибкой.
 */
export async function login(login: string, password: string, rememberMe: boolean = false): Promise<any> {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    const fingerprint = result.visitorId;

    const requestBody: ILoginRequest = {
        login,
        password,
        fingerprint
    };

    const response: { success: boolean; data?: { access_token: string; refresh_token?: string } } = await api.post(Endpoints.login, requestBody);

    if (response.success && response.data?.access_token) {
        try {
            localStorage.removeItem(CACHE_KEY_USER_DATA);
        } catch {
            console.warn('Не удалось очистить кеш пользователя');
        }

        setTokenStore({
            accessToken: response.data.access_token,
            refreshToken: rememberMe ? response.data.refresh_token : undefined
        });
        scheduleTokenRefresh(response.data.access_token);
    }

    return response.data;
}

/**
 * Получение данных текущего пользователя.
 * @returns {Promise<any>} Данные пользователя или ошибка.
 */
export async function getUserData(): Promise<IUserData> {
    const tokens = getAuthTokens();
    if (!tokens?.accessToken) throw new Error('Access token is missing');

    try {
        const cacheRaw = localStorage.getItem(CACHE_KEY_USER_DATA);
        if (cacheRaw) {
            const cache = JSON.parse(cacheRaw);
            if (Date.now() - cache.timestamp < CACHE_TTL_USER_DATA) {
                currentUser.set(cache.data);
                return cache.data;
            }
        }
    } catch {
        console.warn('Не удалось загрузить данные пользователя из кеша');
    }

    const response = await api.get<IUserData>(Endpoints.getUserData);

    if (response.success && response.data) {
        currentUser.set(response.data);

        try {
            localStorage.setItem(CACHE_KEY_USER_DATA, JSON.stringify({
                timestamp: Date.now(),
                data: response.data
            }));
        } catch {
            console.warn('Не удалось сохранить данные пользователя в кеш');
        }

        return response.data;
    } else {
        throw new Error(response.error || 'Failed to fetch user data');
    }
}

let visibilityHandlerSet = false;

/**
 * Обработчик событий видимости и фокуса.
 * Проверяет срок действия токена при изменении видимости окна.
 * @returns {void}
 */
export function onVisibilityOrFocus() {
    const tokens = getAuthTokens();
    if (!tokens?.accessToken) return;
    else{
        const exp = getTokenExpiration(tokens.accessToken);
        if (!exp) return;
        else {
            const now = Date.now();
            if (exp - now < 6 * 60 * 1000) tryRefresh();
            else return;
        }
    }
}

/**
 * Проверка аутентификации пользователя.
 * Получает данные пользователя, если токен действителен.
 * Инциализирует состояние аутентификации и текущего пользователя.
 */
export async function checkAuthentication() {
    if (authChecking) return;
    else {
        authChecking = true;
        
        try {
            const tokenData = localStorage.getItem('auth_tokens');
        
            if (tokenData) {
                try {
                    const tokens = JSON.parse(tokenData);
                    if (tokens && tokens.accessToken) {
                        const isValid = isTokenValid(tokens.accessToken);

                        if (isValid) {
                            isAuthenticated.set(true);
                            scheduleTokenRefresh(tokens.accessToken);

                            if (!get(currentUser)) {
                                const user = await getUserData();
                                currentUser.set(user);
                            } else {
                                isAuthenticated.set(true);
                            }
                        } else {
                            isAuthenticated.set(false);
                        }
                    } else {
                        authChecking = false;
                        authCheckComplete.set(true);
                    }
                } catch (e) {
                    isAuthenticated.set(false);
                    clearAuthTokens();
                }
            } else {
                authChecking = false;
                authCheckComplete.set(true);
            }
        } finally {
            authChecking = false;
            authCheckComplete.set(true);

            if (!visibilityHandlerSet && typeof window !== 'undefined') {
                window.addEventListener('visibilitychange', onVisibilityOrFocus);
                window.addEventListener('focus', onVisibilityOrFocus);
                visibilityHandlerSet = true;
            }
        }
    }
}

/**
 * Завершение регистрации пользователя
 * @param fullName Полное имя пользователя
 * @param login Логин пользователя
 * @param password Пароль пользователя
 * @param token Токен подтверждения регистрации
 * @returns Promise<boolean> - true если регистрация успешна, false в противном случае
 */
export async function finishRegistration(
    fullName: string,
    login: string,
    password: string,
    token: string
): Promise<boolean> {
    try {
        const res = await api.post('/api/v1/auth/register', {
            name: fullName,
            login,
            password,
            token
        });
        
        if (res.success) {
            notification('Регистрация завершена!', NotificationType.Success);
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
            return true;
        } else {
            notification('Ошибка регистрации', NotificationType.Error);
            return false;
        }
    } catch (error) {
        notification('Ошибка регистрации', NotificationType.Error);
        return false;
    }
}