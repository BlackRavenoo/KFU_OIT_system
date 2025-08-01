/**
 * @file +layout.js
 * Файл для настройки макета приложения.
 */

import { setTokenStorage, LocalStorageTokenStorage } from '$lib/utils/auth/tokens/storage';
import { setTicketsFiltersStorage, LocalStorageTicketsFiltersStorage } from '$lib/utils/tickets/stores';

setTokenStorage(new LocalStorageTokenStorage());
setTicketsFiltersStorage(new LocalStorageTicketsFiltersStorage());

export const ssr = false;