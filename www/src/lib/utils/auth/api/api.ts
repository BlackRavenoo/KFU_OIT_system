/**
 * @file auth.api.ts
 * Модуль для управления авторизацией пользователей.
 * Содержит функции для входа, выхода, обновления токенов и получения данных пользователя.
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';

import { getAuthTokens, clearAuthTokens } from '../tokens/tokens';
import { setTokenStore } from '../tokens/storage';
import { currentUser, isAuthenticated } from '../store/initial';
import { AUTH_API_ENDPOINTS as Endpoints } from './endpoints';

import type { ILoginRequest, IUserData } from '../types';

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
        }

        return data;
    } catch (error) {
        throw error;
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

        const response = await fetch(Endpoints.refresh, {
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
            setTokenStore({
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
        
        isAuthenticated.set(false);
        currentUser.set(null);
        
        const currentPath = window.location.pathname;
        if (currentPath !== '/' && currentPath !== '')
            window.location.href = '/';
    } catch (error) {
        throw error;
    }
}