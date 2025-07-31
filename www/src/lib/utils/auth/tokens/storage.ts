import type { IAuthTokens, ITokenStorage } from '../types';

/**
 * Реализация хранилища токенов через localStorage и внутреннее состояние.
 */
export class LocalStorageTokenStorage implements ITokenStorage {
    private tokens: IAuthTokens | null = null;

    constructor() {
        this.tokens = this.readFromLocalStorage();
    }

    private readFromLocalStorage(): IAuthTokens | null {
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

    get(): IAuthTokens | null {
        return this.tokens;
    }

    set(tokens: IAuthTokens | null): void {
        this.tokens = tokens;
        tokens ?
            localStorage.setItem('auth_tokens', JSON.stringify(tokens)) :
            localStorage.removeItem('auth_tokens');
    }

    clear(): void {
        this.tokens = null;
        localStorage.removeItem('auth_tokens');
    }
}

/**
 * Абстракция для работы с хранилищем токенов.
 */
let tokenStorage: ITokenStorage | null = null;

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