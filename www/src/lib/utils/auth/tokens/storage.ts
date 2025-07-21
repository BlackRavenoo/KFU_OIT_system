import type { IAuthTokens, ITokenStorage } from '../types';

/**
 * Реализация хранилища токенов через localStorage.
 */
export class LocalStorageTokenStorage implements ITokenStorage {
    get(): IAuthTokens | null {
        try {
            const storedTokens = localStorage.getItem('auth_tokens');
            if (storedTokens) {
                const parsed = JSON.parse(storedTokens);
                return parsed && parsed.accessToken ? parsed : null;
            }
        } catch {
            localStorage.removeItem('auth_tokens');
        }
        return null;
    }

    set(tokens: IAuthTokens | null): void {
        tokens ?
            localStorage.setItem('auth_tokens', JSON.stringify(tokens)) :
            localStorage.removeItem('auth_tokens');
    }

    clear(): void {
        localStorage.removeItem('auth_tokens');
    }
}

/**
 * Абстракция для работы с хранилищем токенов.
 */
let tokenStorage: ITokenStorage | null = null;

/**
 * Внедрение реализации хранилища токенов.
 */
export function setTokenStorage(storage: ITokenStorage) {
    tokenStorage = storage;
}

/**
 * Получение текущей реализации хранилища токенов.
 */
export function getTokenStorage(): ITokenStorage {
    if (!tokenStorage)
        throw new Error('Token storage is not initialized');
    return tokenStorage;
}

/**
 * Получить токены из хранилища.
 */
export function getTokenStore(): IAuthTokens | null {
    return getTokenStorage().get();
}

/**
 * Сохранить токены в хранилище.
 */
export function setTokenStore(tokens: IAuthTokens | null) {
    getTokenStorage().set(tokens);
}

/**
 * Очистить токены в хранилище.
 */
export function clearTokenStore() {
    getTokenStorage().clear();
}