import type { IAuthTokens, ITokenStorage } from '../types';

/**
 * Реализация хранилища токенов через localStorage и внутреннее состояние.
 */
export class LocalStorageTokenStorage implements ITokenStorage {
    private tokens: IAuthTokens | null = null;

    constructor() {
        this.tokens = this.readFromLocalStorage();
    }

    /**
     * Проверяет доступность localStorage
     * @returns {boolean} true, если localStorage доступен, иначе false
     */
    private isStorageAvailable(): boolean {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, testKey);
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    private readFromLocalStorage(): IAuthTokens {
        const template: IAuthTokens = {
            accessToken: '',
            refreshToken: ''
        }
        if (!this.isStorageAvailable()) return template;

        try {
            const storedTokens = localStorage.getItem('auth_tokens');
            if (storedTokens) {
                const parsed = JSON.parse(storedTokens);
                return parsed && parsed.accessToken ? parsed : null;
            }
        } catch (e) {
            try {
                localStorage.removeItem('auth_tokens');
            } catch { }
        }
        return template;
    }

    get(): IAuthTokens | null {
        return this.tokens;
    }

    set(tokens: IAuthTokens | null): void {
        this.tokens = tokens;
        
        if (!this.isStorageAvailable()) return;
        
        try {
            tokens ?
                localStorage.setItem('auth_tokens', JSON.stringify(tokens)) :
                localStorage.removeItem('auth_tokens');
        } catch (e) {
            console.warn('Не удалось сохранить токены в localStorage:', e);
        }
    }

    clear(): void {
        this.tokens = null;
        
        if (!this.isStorageAvailable()) return;
        
        try {
            localStorage.removeItem('auth_tokens');
        } catch (e) {
            console.warn('Не удалось очистить токены в localStorage:', e);
        }
    }
}

/**
 * Абстракция для работы с хранилищем токенов.
 */
export let tokenStorage: ITokenStorage | null = null;

export function setTokenStorage(storage: ITokenStorage) {
    tokenStorage = storage;
}

export function getTokenStorage(): ITokenStorage {
    if (!tokenStorage)
        throw new Error('Token storage is not initialized');
    return tokenStorage;
}

export function getTokenStore(): IAuthTokens | null {
    return getTokenStorage().get();
}

export function setTokenStore(tokens: IAuthTokens | null) {
    getTokenStorage().set(tokens);
}

export function clearTokenStore() {
    getTokenStorage().clear();
}