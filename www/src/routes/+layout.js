/**
 * @file +layout.js
 * Файл для настройки макета приложения.
 */

import { setTokenStorage, LocalStorageTokenStorage } from '$lib/utils/auth/tokens/storage';
import { setTicketsFiltersStorage, LocalStorageTicketsFiltersStorage } from '$lib/utils/tickets/stores';
import { fetchConsts } from '$lib/utils/tickets/api/get';
import { browser } from '$app/environment';
import { currentUser, isAuthenticated, initializeAuth } from '$lib/utils/auth/storage/initial';
import { initRequestGate } from '$lib/utils/auth/api/requestGate';

const tokenStorage = new LocalStorageTokenStorage();
setTokenStorage(tokenStorage);

setTicketsFiltersStorage(new LocalStorageTicketsFiltersStorage());

if (browser) {
    const { initialAuthState, initialUserData } = initializeAuth();

    currentUser.set(initialUserData);
    isAuthenticated.set(initialAuthState);

    initRequestGate();
}

fetchConsts();

export const ssr = false;