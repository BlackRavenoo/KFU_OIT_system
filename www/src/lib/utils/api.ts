import { refreshAuthTokens } from '$lib/utils/auth/api/api';
import { getAuthTokens } from '$lib/utils/auth/tokens/tokens';
import { notification, NotificationType } from '$lib/utils/notifications/notification';
import { logout } from '$lib/utils/auth/api/api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    status: number;
}

/**
 * Универсальная функция для работы с API
 * @param route - URL маршрут для запроса
 * @param method - HTTP метод
 * @param data - Данные для отправки (опционально)
 * @returns Promise с ответом от сервера
 */
export async function apiHandler<T = any>(
    route: string,
    method: HttpMethod,
    data?: Record<string, any>,
    responseType: 'json' | 'blob' = 'json'
): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {};

    const tokens = getAuthTokens();
    if (tokens?.accessToken)
        headers['Authorization'] = `Bearer ${tokens.accessToken}`;

    const requestOptions: RequestInit = {
        method,
        headers,
        credentials: 'include'
    };

    if (data) {
        if (data instanceof FormData) {
            requestOptions.body = data;
        } else {
            headers['Content-Type'] = 'application/json';
            requestOptions.body = JSON.stringify(data);
        }
    }

    try {
        let response = await fetch(route, requestOptions);
        
        if (response.ok) {
            if (responseType === 'blob') {
                const blobData = await response.blob();
                return { success: true, data: blobData as T, status: response.status };
            } else {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const responseData = await response.json();
                    return { success: true, data: responseData, status: response.status };
                } else {
                    return { success: true, status: response.status };
                }
            }
        }

        if (response.status === 404)
            return { success: false, error: 'Данные не были найдены', status: 404 };
    
        if (response.status === 401) {
            const refreshed = await refreshAuthTokens();

            if (refreshed) {
                const newTokens = getAuthTokens();
                if (newTokens?.accessToken) {
                    headers['Authorization'] = `Bearer ${newTokens.accessToken}`;
                    requestOptions.headers = headers;

                    response = await fetch(route, requestOptions);

                    if (response.ok) {
                        try {
                            const contentType = response.headers.get('content-type');
                            if (contentType && contentType.includes('application/json')) {
                                const responseData = await response.json();
                                return { success: true, data: responseData, status: response.status };
                            } else {
                                return { success: true, status: response.status };
                            }
                        } catch (error) {
                            return { success: true, status: response.status };
                        }
                    }
                }
            }

            logout();
            notification('Сессия истекла. Пожалуйста, войдите снова', NotificationType.Warning);
            return { success: false, error: 'Ошибка авторизации', status: 401 };
        }

        if (response.status >= 500) {
            notification('Ошибка запроса', NotificationType.Error);
            return { success: false, error: 'Серверная ошибка', status: response.status };
        }

        try {
            const errorData = await response.json();
            notification(errorData.message || 'Ошибка запроса', NotificationType.Error);
            return { success: false, error: errorData.message || 'Неизвестная ошибка', status: response.status };
        } catch (e) {
            notification('Ошибка запроса', NotificationType.Error);
            return { success: false, error: 'Неизвестная ошибка', status: response.status };
        }
    } catch (error) {
        notification('Ошибка соединения с сервером', NotificationType.Error);
        return { success: false, error: 'Ошибка соединения', status: 0 };
    }
}

export const api = {
    get: <T>(route: string, data?: Record<string, any>, responseType: 'json' | 'blob' = 'json') => apiHandler<T>(route, 'GET', data, responseType),
    post: <T>(route: string, data?: Record<string, any>, responseType: 'json' | 'blob' = 'json') => apiHandler<T>(route, 'POST', data, responseType),
    put: <T>(route: string, data?: Record<string, any>, responseType: 'json' | 'blob' = 'json') => apiHandler<T>(route, 'PUT', data, responseType),
    patch: <T>(route: string, data?: Record<string, any>, responseType: 'json' | 'blob' = 'json') => apiHandler<T>(route, 'PATCH', data, responseType),
    delete: <T>(route: string, data?: Record<string, any>, responseType: 'json' | 'blob' = 'json') => apiHandler<T>(route, 'DELETE', data, responseType)
};