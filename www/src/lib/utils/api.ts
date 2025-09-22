import axios from 'axios'
import type { AxiosInstance, AxiosResponse, AxiosRequestConfig, AxiosError } from 'axios';

import { refreshAuthTokens } from '$lib/utils/auth/api/api';
import { getAuthTokens } from '$lib/utils/auth/tokens/tokens';
import { notification, NotificationType } from '$lib/utils/notifications/notification';
import { logout } from '$lib/utils/auth/api/api';
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
        if (tokens?.accessToken)
            config.headers['Authorization'] = `Bearer ${tokens.accessToken}`;
        else delete config.headers['Authorization'];
        if (config.data instanceof FormData)
            delete config.headers['Content-Type'];
        else config.headers['Content-Type'] = 'application/json';
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error: AxiosError) => {
        if (error.response?.status === 401) {
            const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
            const isRefreshRequest = originalRequest.url?.includes('token') || 
                originalRequest.url?.includes('login') ||
                originalRequest.url?.includes('logout');
            
            if (isRefreshRequest) {
                logout();
                notification('Сессия истекла. Пожалуйста, войдите снова', NotificationType.Warning);
                return Promise.reject(error);
            } else { 
                if (!originalRequest._retry) {
                    originalRequest._retry = true;
                    
                    const refreshed = await refreshAuthTokens();
                    
                    if (refreshed) {
                        const newTokens = getAuthTokens();
                        if (newTokens?.accessToken) {
                            originalRequest.headers = {
                                ...originalRequest.headers,
                                'Authorization': `Bearer ${newTokens.accessToken}`
                            };
                            return apiClient(originalRequest);
                        } else {
                            logout();
                            notification('Сессия истекла. Пожалуйста, войдите снова', NotificationType.Warning);
                            return Promise.reject(error);
                        }
                    } else {
                        logout();
                        notification('Сессия истекла. Пожалуйста, войдите снова', NotificationType.Warning);
                        return Promise.reject(error);
                    }
                }
            }
            
        } else if (error.response) {
            if (error.response.status === 403 || 
                error.response.status === 406 || 
                error.response.status === 407 || 
                error.response.status === 418 || 
                error.response.status === 423 || 
                error.response.status === 451) {
                navigateToError(error.response.status);
            } else if (error.response.status >= 500) {
                const originalRequest = error.config as AxiosRequestConfig & { _retryCount?: number };
                
                if (originalRequest._retryCount === undefined) 
                    originalRequest._retryCount = 0;
                else if (originalRequest._retryCount < 3) {
                    originalRequest._retryCount++;

                    const retryDelay = Math.pow(3, originalRequest._retryCount - 1) * 1000;
                    
                    return new Promise(resolve => {
                        setTimeout(() => {
                            resolve(apiClient(originalRequest));
                        }, retryDelay);
                    });
                } else notification('Ошибка запроса', NotificationType.Error);
            } else notification('Ошибка запроса', NotificationType.Error);
        } else notification('Ошибка соединения с сервером', NotificationType.Error);
        
        return Promise.reject(error);
    }
);

function formatResponse<T>(response: AxiosResponse): ApiResponse<T> {
    return {
        success: true,
        data: response.data,
        status: response.status
    };
}

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
    get: async <T>(route: string, data?: Record<string, any>, responseType: 'json' | 'blob' = 'json'): Promise<ApiResponse<T>> => {
        try {
            const config: AxiosRequestConfig = {
                params: data,
                responseType: responseType
            };
            
            const response = await apiClient.get<T>(route, config);
            return formatResponse<T>(response);
        } catch (error) {
            return formatError(error as AxiosError);
        }
    },
    
    post: async <T>(route: string, data?: Record<string, any>, responseType: 'json' | 'blob' = 'json'): Promise<ApiResponse<T>> => {
        try {
            const config: AxiosRequestConfig = {
                responseType: responseType
            };
            
            const response = await apiClient.post<T>(route, data, config);
            return formatResponse<T>(response);
        } catch (error) {
            return formatError(error as AxiosError);
        }
    },
    
    put: async <T>(route: string, data?: Record<string, any>, responseType: 'json' | 'blob' = 'json'): Promise<ApiResponse<T>> => {
        try {
            const config: AxiosRequestConfig = {
                responseType: responseType
            };
            
            const response = await apiClient.put<T>(route, data, config);
            return formatResponse<T>(response);
        } catch (error) {
            return formatError(error as AxiosError);
        }
    },
    
    patch: async <T>(route: string, data?: Record<string, any>, responseType: 'json' | 'blob' = 'json'): Promise<ApiResponse<T>> => {
        try {
            const config: AxiosRequestConfig = {
                responseType: responseType
            };
            
            const response = await apiClient.patch<T>(route, data, config);
            return formatResponse<T>(response);
        } catch (error) {
            return formatError(error as AxiosError);
        }
    },
    
    delete: async <T>(route: string, data?: Record<string, any>, responseType: 'json' | 'blob' = 'json'): Promise<ApiResponse<T>> => {
        try {
            const config: AxiosRequestConfig = {
                data,
                responseType: responseType
            };
            
            const response = await apiClient.delete<T>(route, config);
            return formatResponse<T>(response);
        } catch (error) {
            return formatError(error as AxiosError);
        }
    }
};

export default apiClient;