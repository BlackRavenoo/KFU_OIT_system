/**
 * @file auth.store.ts
 * Модуль для управления авторизацией пользователей.
 * Содержит функции для хранения и получения состояния авторизации,
 * а также для синхронизации с localStorage.
 */

import { browser } from '$app/environment';
import { writable } from 'svelte/store';

import type { IUserData } from '../types';
import { LocalStorageAuthStore } from '$lib/utils/auth/storage/storage';

// Экземпляр хранилища для авторизационных данных.
export const authStore = new LocalStorageAuthStore();

let initialAuthState = false;
let initialUserData: IUserData | null = null;

/**
 * Функция для инициализации состояния авторизации при загрузке приложения.
 * Пытается загрузить данные из localStorage и парсит их. Если данные некорректные,
 * очищает их из хранилища и устанавливает состояние по умолчанию.
 * @returns {{ initialAuthState: boolean, 
 * initialUserData: IUserData | null }} Начальное состояние авторизации и данные пользователя.
 */
export function initializeAuth() {
    if (browser) {
        try {
            const storedAuth = authStore.get('auth_state');
            const storedUser = authStore.get('auth_user');
            
            const hasInvalidAuthData = 
                storedAuth === null || 
                storedUser === null || 
                storedUser === undefined || 
                storedAuth === undefined ||
                storedAuth === '' || 
                storedUser === '';
                
            if (hasInvalidAuthData) {
                authStore.clear('auth_state');
                authStore.clear('auth_user');
                initialAuthState = false;
                initialUserData = null;
            } else {
                initialAuthState = JSON.parse(storedAuth);
                initialUserData = JSON.parse(storedUser);
            }
        } catch (e) {
            authStore.clear('auth_state');
            authStore.clear('auth_user');
            initialAuthState = false;
            initialUserData = null;
        }
    }

    return { initialAuthState, initialUserData };
}

// Переменные для хранения текущего состояния авторизации и данных пользователя.
export const currentUser = writable<IUserData | null>(browser ? initialUserData : null);
export const isAuthenticated = writable<boolean>(browser ? initialAuthState : false);

// Синхронизация состояния авторизации с localStorage при изменении.
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