/**
 * @file auth.store.ts
 * Модуль для управления авторизацией пользователей.
 * Содержит функции для хранения и получения состояния авторизации,
 * а также для синхронизации с localStorage.
 */

import { browser } from '$app/environment';
import { writable } from 'svelte/store';

import { getAuthTokens } from '../tokens/tokens';
import { setTokenStore } from '../tokens/storage';
import { LocalStorageAuthStore  } from './storage';

import type { Writable } from 'svelte/store';
import type { IAuthTokens, IUserData } from '../types';

export const tokens = writable<IAuthTokens | null>(null);
export const currentUser = writable<IUserData | null>(null);
export const isAuthenticated = writable<boolean>(false);

let initialAuthState = false;
let initialUserData = null;

const authStore = new LocalStorageAuthStore();

/**
 * Попытка восстановить состояние авторизации
 */
if (browser) {
    try {
        const storedAuth = authStore.get('auth_state');
        const storedUser = authStore.get('auth_user');

        if (storedAuth) initialAuthState = JSON.parse(storedAuth);
        if (storedUser) initialUserData = JSON.parse(storedUser);

    } catch (e) {
        console.error('Ошибка при восстановлении состояния авторизации:', e);
    }
}

if (browser) {
    currentUser.subscribe(value => {
        value ?
            authStore.set('auth_user', JSON.stringify(value)) :
            authStore.clear('auth_user');
    });

    isAuthenticated.subscribe(value => {
        authStore.set('auth_state', JSON.stringify(value));
    });
}

/**
 * Создает Svelte store для хранения токенов авторизации.
 * Этот store будет синхронизирован с localStorage,
 * чтобы сохранять состояние между перезагрузками страницы.
 * @returns {Writable<AuthTokens | null>} Svelte store с токенами авторизации.
 */
function createTokenStore(): Writable<IAuthTokens | null> {
    const initialTokens = getAuthTokens();
    const store = writable<IAuthTokens | null>(initialTokens);
    
    store.subscribe(value => {
        if (value) {
            authStore.set('auth_tokens', JSON.stringify(value));
            setTokenStore(value);
        } else {
            authStore.clear('auth_tokens');
            setTokenStore(null);
        }
    });
    
    return store;
}