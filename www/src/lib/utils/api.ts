import axios from 'axios';
import { goto } from '$app/navigation';
import type { AxiosInstance, AxiosResponse, AxiosRequestConfig, AxiosError } from 'axios';

import { refreshAuthTokens, logout } from '$lib/utils/auth/api/api';
import { getAuthTokens } from '$lib/utils/auth/tokens/tokens';
import { notification } from '$lib/utils/notifications/notification';
import { NotificationType } from '$lib/utils/notifications/types';
import { navigateToError } from './error';
import { isGateOpen, waitForGate, isAuthBypassUrl } from '$lib/utils/auth/api/requestGate';

/**
 * Интерфейс для стандартного ответа API
 * @template T - Тип данных в поле data
 */
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    status: number;
}

/**
 * Создание экземпляра Axios с базовой конфигурацией для API запросов
 */
const apiClient: AxiosInstance = axios.create({
    baseURL: '',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    withCredentials: true
});

/**
 * Перехватчик запросов для добавления токена авторизации и управления "воротами" доступа
 * - Проверяет, нужно ли открывать "ворота" для данного URL
 * - Добавляет токен авторизации в заголовки, если он есть
 * - Управляет Content-Type в зависимости от типа данных
 */
apiClient.interceptors.request.use(
    async (config) => {
        if (!isAuthBypassUrl(config.url) && !isGateOpen()) {
            const gateSuccess = await waitForGate();
            if (!gateSuccess) throw new axios.Cancel('Валидация токена не удалась');
            else console.debug('Request gate opened, proceeding with request');
        }

        const tokens = getAuthTokens();
        if (tokens?.accessToken) config.headers['Authorization'] = `Bearer ${tokens.accessToken}`;
        else delete config.headers['Authorization'];

        if (config.data instanceof FormData)
            delete config.headers['Content-Type'];
        else
            config.headers['Content-Type'] = 'application/json';

        return config;
    },
    (error) => Promise.reject(error)
);

/**
 * Перехватчик ответов для обработки ошибок авторизации и других ошибок API
 * - Обрабатывает 401 и 403 ошибки, связанные с авторизацией, с попыткой обновления токенов
 * - Перенаправляет на страницу входа при необходимости
 * - Показывает уведомления об ошибках и перенаправляет на страницы ошибок при определенных статусах
 * - Реализует стратегию повторных попыток для ошибок сервера (5xx)
 */
apiClient.interceptors.response.use(
    (response) => response,
    async (error: any) => {
        if (axios.isCancel(error)) return Promise.reject(error);

        const axiosError = error as AxiosError;
        const status = axiosError.response?.status ?? 0;
        const originalRequest = axiosError.config as AxiosRequestConfig & {
            _refreshAttempted?: boolean;
            _retryCount?: number;
        };

        const path = extractPath(originalRequest.url);
        const isApiRoute = path.startsWith('/api/');

        if (isApiRoute && (status === 401 || status === 403)) {
            const isAuthEndpoint =
                path.includes('token') ||
                path.includes('login') ||
                path.includes('logout');

            if (isAuthEndpoint) {
                logout();
                notification('Сессия истекла. Пожалуйста, войдите снова', NotificationType.Warning);
                return Promise.reject(axiosError);
            }

            if (!originalRequest._refreshAttempted) {
                originalRequest._refreshAttempted = true;

                let refreshedOk = false;
                try {
                    refreshedOk = await refreshAuthTokens();
                } catch {
                    refreshedOk = false;
                }

                if (refreshedOk) {
                    const tokens = getAuthTokens();
                    if (tokens?.accessToken) {
                        const headers = (originalRequest.headers ?? {}) as Record<string, any>;
                        headers['Authorization'] = `Bearer ${tokens.accessToken}`;
                        originalRequest.headers = headers;
                    } else return apiClient(originalRequest);
                }

                logout();
                notification('Сессия истекла. Пожалуйста, войдите снова', NotificationType.Warning);
                return Promise.reject(axiosError);
            }

            if (status === 401) {
                logout();
                notification('Сессия истекла. Пожалуйста, войдите снова', NotificationType.Warning);
                return Promise.reject(axiosError);
            } else {
                navigateToError(403);
                return Promise.reject(axiosError);
            }
        }

        if (axiosError.response) {
            if (
                status === 403 ||
                status === 406 ||
                status === 407 ||
                status === 418 ||
                status === 423 ||
                status === 451
            ) {
                navigateToError(status);
            } else if (status >= 500) {
                if (originalRequest._retryCount === undefined)
                    originalRequest._retryCount = 0;

                if (originalRequest._retryCount < 3) {
                    originalRequest._retryCount++;
                    const retryDelay = Math.pow(3, originalRequest._retryCount - 1) * 1000;
                    return new Promise(resolve => {
                        setTimeout(() => resolve(apiClient(originalRequest)), retryDelay);
                    });
                } else {
                    notification('Ошибка запроса', NotificationType.Error);
                }
            } else {
                notification('Ошибка запроса', NotificationType.Error);
            }
        } else {
            notification('Ошибка соединения с сервером', NotificationType.Error);
        }

        return Promise.reject(axiosError);
    }
);

/**
 * Извлекает путь из URL
 * @param {string} [url] - URL для извлечения пути
 * @returns {string} Путь из URL
 */
function extractPath(url?: string): string {
    if (!url) return '';
    try {
        if (/^https?:\/\//i.test(url)) return new URL(url).pathname || '';
        return url.startsWith('/') ? url : `/${url}`;
    } catch {
        return url;
    }
}

/**
 * Обработчик ошибок аутентификации, перенаправляющий пользователя на страницу входа
 * Сохраняет текущий путь для последующего перенаправления после успешного входа
 * @param {string} [path] - Путь, на который нужно перенаправить пользователя
 */
export function handleAuthError(path?: string): void {
    try {
        const current =
            (typeof window !== 'undefined'
                ? `${window.location.pathname}${window.location.search}`
                : path) || '/';
        goto(`/?action=login&route=${ encodeURIComponent(current) }`);
    } catch { }
}

/**
 * Форматирует успешный ответ от API
 * @param {AxiosResponse} response - ответ Axios
 * @returns {ApiResponse<T>} Отформатированный ответ
 */
function formatResponse<T>(response: AxiosResponse): ApiResponse<T> {
    return {
        success: true,
        data: response.data,
        status: response.status
    };
}

/**
 * Форматирует ошибку от API
 * @param {AxiosError} error - ошибка Axios
 * @returns {ApiResponse} Отформатированная ошибка
 */
function formatError(error: AxiosError): ApiResponse {
    if (error.response) {
        if (error.response.status === 404) {
            return {
                success: false,
                error: 'Данные не были найдены',
                status: 404
            };
        }
        return {
            success: false,
            error: (error.response.data as { message?: string })?.message || 'Ошибка запроса',
            status: error.response.status
        };
    }
    return {
        success: false,
        error: 'Ошибка соединения',
        status: 0
    };
}

/**
 * Унифицированный интерфейс для выполнения API запросов с поддержкой различных HTTP методов, типов данных и обработки ошибок
 * - Позволяет выполнять GET, POST, PUT, PATCH и DELETE запросы
 * - Поддерживает отправку данных в виде JSON или FormData
 * - Обрабатывает ошибки и возвращает стандартизированный ответ ApiResponse
 * @typeParam T - Тип данных в поле data успешного ответа
 */
export const api = {
    get: async <T>(
        route: string,
        data?: Record<string, any>,
        responseType: 'json' | 'blob' = 'json',
        withCredentials?: boolean
    ): Promise<ApiResponse<T>> => {
        try {
            const config: AxiosRequestConfig = {
                params: data,
                responseType,
                withCredentials: withCredentials ?? true
            };
            const response = await apiClient.get<T>(route, config);
            return formatResponse<T>(response);
        } catch (error) {
            if (axios.isCancel(error)) return { success: false, error: 'cancelled', status: 0 };
            return formatError(error as AxiosError);
        }
    },

    post: async <T>(
        route: string,
        data?: Record<string, any> | FormData,
        responseType: 'json' | 'blob' = 'json',
        withCredentials?: boolean
    ): Promise<ApiResponse<T>> => {
        try {
            const config: AxiosRequestConfig = {
                responseType,
                withCredentials: withCredentials ?? true
            };
            const response = await apiClient.post<T>(route, data, config);
            return formatResponse<T>(response);
        } catch (error) {
            if (axios.isCancel(error)) return { success: false, error: 'cancelled', status: 0 };
            return formatError(error as AxiosError);
        }
    },

    put: async <T>(
        route: string,
        data?: Record<string, any> | FormData,
        responseType: 'json' | 'blob' = 'json',
        withCredentials?: boolean
    ): Promise<ApiResponse<T>> => {
        try {
            const config: AxiosRequestConfig = {
                responseType,
                withCredentials: withCredentials ?? true
            };
            const response = await apiClient.put<T>(route, data, config);
            return formatResponse<T>(response);
        } catch (error) {
            if (axios.isCancel(error)) return { success: false, error: 'cancelled', status: 0 };
            return formatError(error as AxiosError);
        }
    },

    patch: async <T>(
        route: string,
        data?: Record<string, any> | FormData,
        responseType: 'json' | 'blob' = 'json',
        withCredentials?: boolean
    ): Promise<ApiResponse<T>> => {
        try {
            const config: AxiosRequestConfig = {
                responseType,
                withCredentials: withCredentials ?? true
            };
            const response = await apiClient.patch<T>(route, data, config);
            return formatResponse<T>(response);
        } catch (error) {
            if (axios.isCancel(error)) return { success: false, error: 'cancelled', status: 0 };
            return formatError(error as AxiosError);
        }
    },

    delete: async <T>(
        route: string,
        data?: Record<string, any>,
        responseType: 'json' | 'blob' = 'json',
        withCredentials?: boolean
    ): Promise<ApiResponse<T>> => {
        try {
            const config: AxiosRequestConfig = {
                data,
                responseType,
                withCredentials: withCredentials ?? true
            };
            const response = await apiClient.delete<T>(route, config);
            return formatResponse<T>(response);
        } catch (error) {
            if (axios.isCancel(error)) return { success: false, error: 'cancelled', status: 0 };
            return formatError(error as AxiosError);
        }
    }
};

export default apiClient;