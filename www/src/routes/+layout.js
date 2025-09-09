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
import { logout, getUserData } from '$lib/utils/auth/api/api';

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
            const refreshToken = tokenData?.refreshToken;
            
            if (accessToken) {
                const isTokenValid = await checkToken();
                
                if (!isTokenValid && refreshToken) {
                    const refreshed = await refreshAuthTokens();
                    if (refreshed) {
                        try {
                            const userData = await getUserData();
                            isAuthenticated.set(true);
                            authStore.set('auth_state', "true");
                        } catch (error) {
                            await logout();
                        }
                    } else {
                        await logout();
                    }
                } else if (!isTokenValid) {
                    await logout();
                } else {
                    try {
                        const userData = await getUserData();
                        isAuthenticated.set(true);
                        authStore.set('auth_state', "true");
                    } catch (error) {
                        await logout();
                    }
                }
            } else if (initialAuthState) {
                await logout();
            }
        } catch (error) { }
    })();
}

fetchConsts();

export const ssr = false;