import type { IAuthTokens, ITokenStorage } from '../types';

/**
 * Реализация хранилища токенов через localStorage и внутреннее состояние.
 */
export class LocalStorageTokenStorage implements ITokenStorage {
    private tokens: IAuthTokens | null = null;

    /**
     * Создаёт экземпляр и инициализирует токены из localStorage. 
     * Если localStorage недоступен, используется пустой шаблон.
     */
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

    /**
     * Функция для чтения токенов из localStorage. 
     * Если данные повреждены или отсутствуют, возвращает шаблон с пустыми строками.
     * @returns {IAuthTokens} Токены авторизации или шаблон с пустыми строками.
     */
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

    /**
     * Функция для получения текущих токенов из памяти.
     * @returns {IAuthTokens | null} Токены авторизации или null, если токены не установлены.
     */
    get(): IAuthTokens | null {
        return this.tokens;
    }

    /**
     * Функция для установки токенов в память и сохранения их в localStorage.
     * @param tokens - Токены авторизации для сохранения. Если null, токены будут удалены.
     */
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

    /**
     * Функция для очистки токенов из памяти и localStorage.
     */
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

// Абстракция для работы с хранилищем токенов.
export let tokenStorage: ITokenStorage | null = null;

/**
 * Функция для установки глобального экземпляра хранилища токенов.
 * @param storage - Экземпляр хранилища токенов для использования в приложении.
 */
export function setTokenStorage(storage: ITokenStorage) {
    tokenStorage = storage;
}

/**
 * Функция для получения текущего экземпляра хранилища токенов.
 * @throws {Error} Если хранилище токенов не инициализировано.
 * @returns {ITokenStorage} Текущий экземпляр хранилища токенов.
 */
export function getTokenStorage(): ITokenStorage {
    if (!tokenStorage)
        throw new Error('Token storage is not initialized');
    return tokenStorage;
}

/**
 * Функция для получения текущих токенов авторизации из хранилища.
 * @returns {IAuthTokens | null} Текущие токены авторизации или null, если токены не установлены.
 */
export function getTokenStore(): IAuthTokens | null {
    return getTokenStorage().get();
}

/**
 * Функция для установки токенов авторизации в хранилище.
 * @param tokens - Токены авторизации для сохранения.
 */
export function setTokenStore(tokens: IAuthTokens | null) {
    getTokenStorage().set(tokens);
}

/**
 * Функция для очистки токенов авторизации из хранилища.
 */
export function clearTokenStore() {
    getTokenStorage().clear();
}