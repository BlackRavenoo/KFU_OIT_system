/**
 * @file +layout.js
 * Файл для настройки макета приложения.
 */

import { setTokenStorage, LocalStorageTokenStorage } from '$lib/utils/auth/tokens/storage';
import { setTicketsFiltersStorage, LocalStorageTicketsFiltersStorage } from '$lib/utils/tickets/stores';
import { fetchConsts } from '$lib/utils/tickets/api/get';
import { checkToken, refreshAuthTokens } from '$lib/utils/auth/tokens/tokens';
import { browser } from '$app/environment';
import { authStore, initializeAuth, currentUser, isAuthenticated } from '$lib/utils/auth/storage/initial';
import { logout } from '$lib/utils/auth/api/api';

const tokenStorage = new LocalStorageTokenStorage();
setTokenStorage(tokenStorage);

setTicketsFiltersStorage(new LocalStorageTicketsFiltersStorage());

if (browser) {
    const { initialAuthState, initialUserData } = initializeAuth();
    
    currentUser.set(initialUserData);
    isAuthenticated.set(initialAuthState);
    
    (async () => {
        try {
            const tokenData = await tokenStorage.get();
            const accessToken = tokenData?.accessToken;
            const currentAuthState = authStore.get('auth_state');
            
            if (accessToken) {
                let isTokenExpired = await checkToken();
                (!isTokenExpired || currentAuthState == "false" || !currentAuthState) && await refreshAuthTokens();
            } else if (initialAuthState) {
                await logout();
            }
        } catch (error) { }
    })();
}

fetchConsts();

export const ssr = false;