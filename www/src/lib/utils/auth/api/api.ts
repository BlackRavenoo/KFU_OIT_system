/**
 * @file auth.api.ts
 * Модуль для управления авторизацией пользователей.
 * Содержит функции для входа, выхода, обновления токенов и получения данных пользователя.
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';

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
        let resultText = '';
        const tokensData = getAuthTokens();
        const deadline = getTokenExpiration(tokensData?.accessToken || token);

        try {
            const ok = await refreshAuthTokens(true, deadline ?? undefined);
            if (ok) {
                resultText = 'Токен успешно обновлён';
                const newToken = getAuthTokens()?.accessToken;
                if (newToken) scheduleTokenRefresh(newToken);
            } else {
                resultText = 'Ошибка обновления токена: сервер вернул ошибку';
                if (Date.now() < (deadline ?? 0))
                    refreshTimeout = setTimeout(tryRefresh, 60 * 1000);
                else
                    logout();
            }
        } catch (e: any) {
            resultText = 'Ошибка обновления токена: ' + (e?.message || e);
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
    try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        const fingerprint = result.visitorId; 
        const requestBody: ILoginRequest = {
            email,
            password,
            fingerprint
        };    

        const response = await fetch(Endpoints.login, {
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
            setTokenStore({
                accessToken: data.access_token,
                refreshToken: rememberMe ? data.refresh_token : undefined
            });
            scheduleTokenRefresh(data.access_token);
        }

        return data;
    } catch (error) {
        throw error;
    }
}

/** 
 * Обновляет токены авторизации через refresh_token.
 * @param allowRetry - если true, не вызывает logout при ошибке, а только если токен истёк
 * @param deadline - время истечения accessToken
 * @returns {Promise<boolean>} true, если токены успешно обновлены, иначе false.
 */
export async function refreshAuthTokens(allowRetry: boolean = false, deadline?: number): Promise<boolean> {
    try {
        const tokensData = getAuthTokens();
        if (!tokensData?.refreshToken) return false;

        const fp = await FingerprintJS.load();
        const result = await fp.get();
        const fingerprint = result.visitorId;

        const url = new URL(Endpoints.refresh, window.location.origin);
        url.searchParams.set('refresh_token', tokensData.refreshToken);
        url.searchParams.set('fingerprint', fingerprint);

        const response = await fetch(Endpoints.refresh, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'authorization': `Bearer ${getAuthTokens()?.accessToken}`
            },
            body: JSON.stringify({
                refresh_token: tokensData.refreshToken,
                fingerprint
            }),
            credentials: 'include'
        });
        if (!response.ok) {
            !allowRetry || (deadline && Date.now() >= deadline) && logout();
            return false;
        }

        const data = await response.json();

        if (data.access_token && data.refresh_token) {
            setTokenStore({
                accessToken: data.access_token,
                refreshToken: data.refresh_token
            });
            scheduleTokenRefresh(data.access_token);
            return true;
        }

        !allowRetry || (deadline && Date.now() >= deadline) && logout();
        return false;
    } catch (error) {
        !allowRetry || (deadline && Date.now() >= deadline) && logout();
        return false;
    }
}

/**
 * Получение данных текущего пользователя.
 * @returns {Promise<any>} Данные пользователя или ошибка.
 */
export async function getUserData(): Promise<IUserData> {
    try {
        const response = await fetch(Endpoints.getUserData, {
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
        if (refreshTimeout) clearTimeout(refreshTimeout);
        isAuthenticated.set(false);
        currentUser.set(null);
        
        const currentPath = window.location.pathname;
        if (currentPath !== '/' && currentPath !== '')
            window.location.href = '/';
    } catch (error) {
        throw error;
    }
}