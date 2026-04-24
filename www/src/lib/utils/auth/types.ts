/**
 * @file auth.types.ts
 * Типы и абстракции для авторизации пользователей.
 */

// Параметры запроса на вход в систему.
export interface ILoginRequest {
    login: string;
    password: string;
    /** Отпечаток устройства/браузера для дополнительной валидации. */
    fingerprint: string;
}

// Набор токенов авторизации.
export interface IAuthTokens {
    /** Короткоживущий токен доступа. */
    accessToken: string;
    /** Токен обновления. */
    refreshToken?: string;
}

// Профильные данные текущего пользователя.
export interface IUserData {
    id: string;
    name: string;
    email: string;
    login: string;
    role: UserRole;
    status: UserStatus;
    avatar_key?: string;
}

// Абстракция хранилища токенов авторизации.
export interface ITokenStorage {
    get(): IAuthTokens | null;
    set(tokens: IAuthTokens | null): void;
    clear(): void;
}

// Абстракция key-value хранилища для auth-данных.
export interface IAuthStore {
    /**
     * Получает значение по имени ключа.
     * @param name Имя ключа.
     * @returns Строковое значение или `null`.
     */
    get(name: string): string | null;

    /**
     * Устанавливает значение по имени ключа.
     * @param name Имя ключа.
     * @param value Значение или `null`.
     */
    set(name: string, value: string | null): void;

    /**
     * Удаляет значение по имени ключа.
     * @param name Имя ключа.
     */
    clear(name: string): void;
}

/**
 * Набор endpoint-ов API для операций авторизации.
 */
export interface IAuthApiEndpoints {
    login: string;
    logout: string;
    refresh: string;
    getUserData: string;
    requestRecovery: string;
    validateRecovery: string;
    confirmRecovery: string;
}

// Роли пользователей в системе.
export enum UserRole {
    Anonymous = "anonymousclient",
    Client = "client",
    Programmer = "employee",
    Moderator = "moderator",
    Administrator = "admin"
}

/**
 * Статусы пользователя.
 */
export enum UserStatus {
    Active = 'available',
    Sick = 'sick',
    Vacation = 'vacation',
    Busy = 'busy'
};