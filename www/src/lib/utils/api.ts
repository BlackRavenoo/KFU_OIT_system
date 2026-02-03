import axios from 'axios';
import { goto } from '$app/navigation';
import type { AxiosInstance, AxiosResponse, AxiosRequestConfig, AxiosError } from 'axios';

import { refreshAuthTokens, logout } from '$lib/utils/auth/api/api';
import { getAuthTokens } from '$lib/utils/auth/tokens/tokens';
import { notification } from '$lib/utils/notifications/notification';
import { NotificationType } from '$lib/utils/notifications/types';
import { navigateToError } from './error';

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    status: number;
}

const apiClient: AxiosInstance = axios.create({
    baseURL: '',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    withCredentials: true
});

apiClient.interceptors.request.use(
    (config) => {
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

apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const status = error.response?.status ?? 0;
        const originalRequest = error.config as AxiosRequestConfig & {
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
                return Promise.reject(error);
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
                return Promise.reject(error);
            }

            if (status === 401) {
                logout();
                notification('Сессия истекла. Пожалуйста, войдите снова', NotificationType.Warning);
                return Promise.reject(error);
            } else {
                navigateToError(403);
                return Promise.reject(error);
            }
        }

        if (error.response) {
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

        return Promise.reject(error);
    }
);

/**
 * Извлекает путь из URL
 * @param url URL для извлечения пути
 * @returns Путь из URL
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
 * @param status Код статуса ошибки
 * @param path Путь, на который нужно перенаправить пользователя
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
 * @param response - ответ Axios
 * @returns ApiResponse
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
 * @param error - ошибка Axios
 * @returns ApiResponse 
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
            return formatError(error as AxiosError);
        }
    },

    post: async <T>(
        route: string,
        data?: Record<string, any>,
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
            return formatError(error as AxiosError);
        }
    },

    put: async <T>(
        route: string,
        data?: Record<string, any>,
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
            return formatError(error as AxiosError);
        }
    },

    patch: async <T>(
        route: string,
        data?: Record<string, any>,
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
            return formatError(error as AxiosError);
        }
    }
};

export default apiClient;