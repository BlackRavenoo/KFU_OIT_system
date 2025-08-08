/**
 * @file auth.api.ts
 * Модуль для управления авторизацией пользователей.
 * Содержит функции для входа, выхода, обновления токенов и получения данных пользователя.
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';

import { api } from '$lib/utils/api';
import { getAuthTokens, clearAuthTokens } from '../tokens/tokens';
import { setTokenStore } from '../tokens/storage';
import { currentUser, isAuthenticated } from '../storage/initial';
import { AUTH_API_ENDPOINTS as Endpoints } from './endpoints';

import type { ILoginRequest, IUserData } from '../types';

let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Парсит время истечения токена из accessToken
 * Если токен не валиден, возвращает null
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
 * Если токен уже истёк, вызывает logout
 * @param token Токен для проверки и планирования обновления
 */
function scheduleTokenRefresh(token: string) {
    if (refreshTimeout) clearTimeout(refreshTimeout);

    const exp = getTokenExpiration(token);
    if (!exp) return;

    const now = Date.now();
    const refreshTime = exp - 5 * 60 * 1000;
    let delay = refreshTime - now;
    if (delay < 0) delay = 0;

    async function tryRefresh() {
        const tokensData = getAuthTokens();
        const deadline = getTokenExpiration(tokensData?.accessToken || token);

        try {
            const ok = await refreshAuthTokens(true, deadline ?? undefined);
            if (ok) {
                const newToken = getAuthTokens()?.accessToken;
                if (newToken) scheduleTokenRefresh(newToken);
            } else {
                if (Date.now() < (deadline ?? 0))
                    refreshTimeout = setTimeout(tryRefresh, 60 * 1000);
                else
                    logout();
            }
        } catch {
            if (Date.now() < (deadline ?? 0))
                refreshTimeout = setTimeout(tryRefresh, 60 * 1000);
            else
                logout();
        }
    }

    refreshTimeout = setTimeout(tryRefresh, delay);
}

/**
 * Аутентификация пользователя с использованием email и пароля.
 * @param email
 * @param password
 * @param rememberMe Флаг "запомнить меня"
 * @returns {Promise<any>} Ответ сервера с данными пользователя или ошибкой.
 */
export async function login(email: string, password: string, rememberMe: boolean = false): Promise<any> {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    const fingerprint = result.visitorId;

    const requestBody: ILoginRequest = {
        email,
        password,
        fingerprint
    };

    const response: { success: boolean; data?: { access_token: string; refresh_token?: string } } = await api.post(Endpoints.login, requestBody);

    if (response.success && response.data?.access_token) {
        setTokenStore({
            accessToken: response.data.access_token,
            refreshToken: rememberMe ? response.data.refresh_token : undefined
        });
        scheduleTokenRefresh(response.data.access_token);
    }

    return response.data;
}

/** 
 * Обновляет токены авторизации через refresh_token.
 * @param allowRetry - если true, не вызывает logout при ошибке, а только если токен истёк
 * @param deadline - время истечения accessToken
 * @returns {Promise<boolean>} true, если токены успешно обновлены, иначе false.
 */
export async function refreshAuthTokens(allowRetry: boolean = false, deadline?: number): Promise<boolean> {
    const tokensData = getAuthTokens();
    if (!tokensData?.refreshToken) return false;

    const fp = await FingerprintJS.load();
    const result = await fp.get();
    const fingerprint = result.visitorId;

    const requestBody = {
        refresh_token: tokensData.refreshToken,
        fingerprint
    };

    const response: { success: boolean; data?: { access_token: string; refresh_token?: string } } = await api.post(Endpoints.refresh, requestBody);

    if (response.success && response.data?.access_token && response.data?.refresh_token) {
        setTokenStore({
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token
        });
        scheduleTokenRefresh(response.data.access_token);
        return true;
    }

    if (!allowRetry || (deadline && Date.now() >= deadline)) logout();
    return false;
}

/**
 * Получение данных текущего пользователя.
 * @returns {Promise<any>} Данные пользователя или ошибка.
 */
export async function getUserData(): Promise<IUserData> {
    const tokens = getAuthTokens();
    if (!tokens?.accessToken) throw new Error('Access token is missing');

    const response = await api.get<IUserData>(Endpoints.getUserData);

    if (response.success && response.data) {
        currentUser.set(response.data);
        return response.data;
    }

    throw new Error(response.error || 'Failed to fetch user data');
}

/**
 * Выход пользователя из системы.
 * @returns {Promise<any>} Ответ сервера со статусом операции.
 */
export async function logout(): Promise<void> {
    clearAuthTokens();
    if (refreshTimeout) clearTimeout(refreshTimeout);
    isAuthenticated.set(false);
    currentUser.set(null);

    const currentPath = window.location.pathname;
    if (currentPath !== '/' && currentPath !== '')
        window.location.href = '/';
}