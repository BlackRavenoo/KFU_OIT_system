/**
 * @file +layout.js
 * Файл для настройки макета приложения.
 */

import { setTokenStorage, LocalStorageTokenStorage } from '$lib/utils/auth/tokens/storage';
import { setTicketsFiltersStorage, LocalStorageTicketsFiltersStorage, } from '$lib/utils/tickets/stores';
import { fetchConsts } from '$lib/utils/tickets/api/get';
import { checkToken, refreshAuthTokens } from '$lib/utils/auth/tokens/tokens';
import { browser } from '$app/environment';
import { authStore } from '$lib/utils/auth/storage/initial';

const tokenStorage = new LocalStorageTokenStorage();
setTokenStorage(tokenStorage);

setTicketsFiltersStorage(new LocalStorageTicketsFiltersStorage());

if (browser) {
    (async () => {
        try {
            const tokenData = await tokenStorage.get();
            const accessToken = tokenData?.accessToken;
            const currentAuthState = authStore.get('auth_state');
            
            if (accessToken) {
                const isTokenExpired = await checkToken();
                (isTokenExpired || currentAuthState == "false" || !currentAuthState) && await refreshAuthTokens();
            }
        } catch (error) { }
    })();
}

fetchConsts();

export const ssr = false;