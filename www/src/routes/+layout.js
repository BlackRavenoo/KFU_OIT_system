/**
 * @file +layout.js
 * Файл для настройки макета приложения.
 */

import { setTokenStorage, LocalStorageTokenStorage } from '$lib/utils/auth/tokens/storage';

setTokenStorage(new LocalStorageTokenStorage());

export const ssr = false;
export const prerender = true;