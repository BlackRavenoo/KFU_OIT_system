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
import { logout } from '../api/api';

export const authStore = new LocalStorageAuthStore();

let initialAuthState = false;
let initialUserData: IUserData | null = null;

if (browser) {
    try {
        const storedAuth = authStore.get('auth_state');
        const storedUser = authStore.get('auth_user');
        
        const hasInvalidAuthData = 
            storedAuth === null || 
            storedUser === null || 
            storedAuth === undefined || 
            storedUser === undefined ||
            storedAuth === '' || 
            storedUser === '';
            
        if (hasInvalidAuthData) {
            logout();
        } else {
            initialAuthState = JSON.parse(storedAuth);
            initialUserData = JSON.parse(storedUser);
        } 

    } catch (e) {
        logout();
    }
}

export const currentUser = writable<IUserData | null>(browser ? initialUserData : null);
export const isAuthenticated = writable<boolean>(browser ? initialAuthState : false);

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