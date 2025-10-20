/**
 * @file auth.types.ts
 * Типы и абстракции для авторизации пользователей.
 * Только определения интерфейсов, типов и абстракций — без конкретных реализаций!
 */

export interface ILoginRequest {
    login: string;
    password: string;
    fingerprint: string;
}

export interface IAuthTokens {
    accessToken: string;
    refreshToken?: string;
}

export interface IUserData {
    id: string;
    name: string;
    email: string;
    login: string;
    role: UserRole;
    status: UserStatus;
    avatar_key?: string;
}

export interface ITokenStorage {
    get(): IAuthTokens | null;
    set(tokens: IAuthTokens | null): void;
    clear(): void;
}

export interface IAuthStore {
    get(name: string): string | null;
    set(name: string, value: string | null): void;
    clear(name: string): void;
}

export interface IAuthApiEndpoints {
    login: string;
    logout: string;
    refresh: string;
    getUserData: string;
}

export enum UserRole {
    Programmer = "employee",
    Moderator = "moderator",
    Administrator = "admin"
}

export enum UserStatus {
    Active = 'available',
    Sick = 'sick',
    Vacation = 'vacation',
    Busy = 'busy'
};