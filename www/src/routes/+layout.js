/**
 * @file +layout.js
 * Файл для настройки макета приложения.
 */

import { setTokenStorage, LocalStorageTokenStorage } from '$lib/utils/auth/tokens/storage';
import { setTicketsFiltersStorage, LocalStorageTicketsFiltersStorage, } from '$lib/utils/tickets/stores';
import { fetchConsts } from '$lib/utils/tickets/api/get';

setTokenStorage(new LocalStorageTokenStorage());
setTicketsFiltersStorage(new LocalStorageTicketsFiltersStorage());
fetchConsts();

export const ssr = false;