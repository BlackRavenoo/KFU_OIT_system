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

import type { ILoginRequest, IUserData } from '$lib/utils/auth/types';

let isRefreshing = false;
let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

export const authCheckComplete = writable(false);
let authChecking = false;

let failedRefreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 3;

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

    refreshTimeout = setTimeout(() => tryRefresh(token), delay);
}

/**
 * Пытается обновить токен
 * @param token Текущий токен доступа
 */
async function tryRefresh(token: string) {
    if (isRefreshing) return;
    
    isRefreshing = true;
    
    const tokensData = getAuthTokens();
    const deadline = getTokenExpiration(tokensData?.accessToken || token);
    try {
        const ok = await refreshAuthTokens(true, deadline ?? undefined);
        
        if (ok) {
            failedRefreshAttempts = 0;
            const newToken = getAuthTokens()?.accessToken;
            if (newToken) scheduleTokenRefresh(newToken);
        } else {
            failedRefreshAttempts++;
            
            if (failedRefreshAttempts >= MAX_REFRESH_ATTEMPTS || Date.now() >= (deadline ?? 0)) {
                localStorage.setItem('last_failed_refresh', Date.now().toString());
                logout();
            } else {
                const backoffDelay = Math.min(1000 * Math.pow(2, failedRefreshAttempts), 60000);
                refreshTimeout = setTimeout(() => tryRefresh(token), backoffDelay);
            }
        }
    } catch (error) {
        failedRefreshAttempts++;
        
        if (failedRefreshAttempts >= MAX_REFRESH_ATTEMPTS) {
            localStorage.setItem('last_failed_refresh', Date.now().toString());
            logout();
        }
    } finally {
        isRefreshing = false;
    }
}

/** 
 * Обновляет токены авторизации через refresh_token.
 * @param allowRetry - если true, не вызывает logout при ошибке, а только если токен истёк
 * @param deadline - время истечения accessToken
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
    
    try {
        const response: { success: boolean; data?: { access_token: string; refresh_token?: string } } = 
            await api.post(Endpoints.refresh, requestBody);
        
        if (response.success && response.data?.access_token && response.data?.refresh_token) {
            setTokenStore({
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token
            });
            
            localStorage.removeItem('last_failed_refresh');
            
            scheduleTokenRefresh(response.data.access_token);
            return true;
        }
    } catch (error) {
        localStorage.setItem('last_failed_refresh', Date.now().toString());
    }
    
    if (!allowRetry || (deadline && Date.now() >= deadline)) {
        logout();
    }
    return false;
}

/**
 * Выход пользователя из системы.
 */
export async function logout(): Promise<void> {
    clearAuthTokens();
    
    if (refreshTimeout) {
        clearTimeout(refreshTimeout);
        refreshTimeout = null;
    }
    
    isRefreshing = false;
    failedRefreshAttempts = 0;
    
    isAuthenticated.set(false);
    currentUser.set(null);

    const currentPath = window.location.pathname;
    if (currentPath !== '/' && currentPath !== '')
        window.location.href = '/';
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
 * Проверка аутентификации пользователя.
 * Получает данные пользователя, если токен действителен.
 * Инциализирует состояние аутентификации и текущего пользователя.
 */
export async function checkAuthentication() {
    if (authChecking) return;
    authChecking = true;
    
    try {
        const tokenData = localStorage.getItem('auth_tokens');
        const lastFailedRefresh = localStorage.getItem('last_failed_refresh');
        const currentTime = Date.now();
        
        if (lastFailedRefresh && (currentTime - parseInt(lastFailedRefresh)) < 5 * 60 * 1000) {
            clearAuthTokens();
            isAuthenticated.set(false);
            currentUser.set(null);
            localStorage.removeItem('last_failed_refresh');
            return;
        }
    
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
                            if (user) currentUser.set(user);
                        }
                    } else {
                        const refreshed = await refreshAuthTokens(true);
                        if (!refreshed) {
                            isAuthenticated.set(false);
                            currentUser.set(null);
                        }
                    }
                }
            } catch (e) {
                console.error('Ошибка при разборе токенов:', e);
                isAuthenticated.set(false);
                clearAuthTokens();
            }
        }
    } finally {
        authChecking = false;
        authCheckComplete.set(true);
    }
}