/**
 * @file requestGate.ts
 * Модуль для управления очередью запросов.
 * 
 * При входе в приложение, если существует сохранённый токен,
 * request gate закрываются и все не-авторизационные запросы ставятся в очередь
 * При успехе — request gate открываются и очередь выполняется
 * При ошибке — повтор каждые 3 секунды, максимум 3 попытки
 * Если все попытки провалились — очередь очищается
 */

import { setTokenStore } from '../tokens/storage';
import { isTokenValid } from '../tokens/tokens';

const MAX_ATTEMPTS = 3;
const RETRY_DELAY = 3000;
const VALIDATE_ENDPOINT = '/api/v1/auth/me';
const REFRESH_ENDPOINT = '/api/v1/auth/token';

// Флаги и объекты для управления состоянием request gate
let gateOpen = true;
let gatePromise: Promise<boolean> | null = null;
let resolveGate: ((value: boolean) => void) | null = null;

/**
 * Закрывает request gate — все последующие вызовы waitForGate()
 * будут ожидать, пока request gate не откроется
 */
function closeGate(): void {
    if (!gateOpen) return;
    gateOpen = false;
    gatePromise = new Promise<boolean>((resolve) => {
        resolveGate = resolve;
    });
}

/**
 * Открывает request gate с успешным результатом — все ожидающие запросы продолжат выполнение
 */
function openGate(): void {
    gateOpen = true;
    if (resolveGate) {
        resolveGate(true);
        resolveGate = null;
    } else console.warn('Request gate opened without pending promise');
    gatePromise = null;
}

/**
 * Открывает request gate с ошибкой — все ожидающие запросы будут отменены
 */
function failGate(): void {
    gateOpen = true;
    if (resolveGate) {
        resolveGate(false);
        resolveGate = null;
    }
    gatePromise = null;
}

/**
 * Проверяет, открыты ли request gate
 * @returns {boolean} true, если request gate открыты, false — если закрыты
 */
export function isGateOpen(): boolean {
    return gateOpen;
}

/**
 * Ожидает открытия request gate
 * @returns {boolean} true — если гейт открылся успешно, false — если валидация провалилась
 */
export async function waitForGate(): Promise<boolean> {
    if (gateOpen || !gatePromise) return true;
    return gatePromise;
}

/**
 * Проверяет, является ли URL авторизационным эндпоинтом,
 * который должен проходить без ожидания request gate
 * @param url URL для проверки
 * @returns {boolean} true — если URL является авторизационным, false — иначе
 */
export function isAuthBypassUrl(url?: string): boolean {
    if (!url) return false;

    let path: string;
    try {
        path = /^https?:\/\//i.test(url) ?
            new URL(url).pathname :
            url.startsWith('/') ? url : `/${url}`;
    } catch {
        path = url;
    }

    return path.startsWith('/api/v1/auth/');
}

/**
 * Валидирует токен в обход axios-перехватчика
 * @param accessToken Токен для валидации
 * @returns {boolean} true — если токен валиден, false — если невалиден или произошла ошибка
 */
async function validateTokenOnServer(accessToken: string): Promise<boolean> {
    try {
        const response = await fetch(VALIDATE_ENDPOINT, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            },
            credentials: 'include'
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Обновляет токены в обход axios-перехватчика
 * @param refreshToken Токен обновления для получения новых токенов
 * @returns Объект с новыми токенами или null, если обновление не удалось
 */
async function refreshTokensRaw(
    refreshToken: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
        const FingerprintJS = (await import('@fingerprintjs/fingerprintjs')).default;
        const fp = await FingerprintJS.load();
        const result = await fp.get();

        const response = await fetch(REFRESH_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                refresh_token: refreshToken,
                fingerprint: result.visitorId
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.access_token && data.refresh_token) {
                return {
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token
                };
            } else console.warn('Refresh response missing tokens');
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Попытка валидации токена
 * @returns {boolean} true — если валидация успешна, false — если неудачна
 */
async function attemptValidation(): Promise<boolean> {
    const raw = localStorage.getItem('auth_tokens');
    if (!raw) return false;

    let tokens: { accessToken?: string; refreshToken?: string };
    try {
        tokens = JSON.parse(raw);
    } catch {
        return false;
    }

    if (!tokens?.accessToken) return false;

    if (isTokenValid(tokens.accessToken)) {
        const serverValid = await validateTokenOnServer(tokens.accessToken);
        if (serverValid) return true;
    }

    if (tokens.refreshToken) {
        const newTokens = await refreshTokensRaw(tokens.refreshToken);
        if (newTokens) {
            setTokenStore({
                accessToken: newTokens.accessToken,
                refreshToken: newTokens.refreshToken
            });
            return true;
        }
    } else console.warn('No refresh token available for validation attempt');

    return false;
}

/**
 * Инициализирует request gate
 * @returns {Promise<void>} Promise, который разрешается после завершения процесса инициализации
 */
export async function initRequestGate(): Promise<void> {
    if (typeof window === 'undefined') return;

    const raw = localStorage.getItem('auth_tokens');
    if (!raw) return;

    let tokens: { accessToken?: string };
    try {
        tokens = JSON.parse(raw);
    } catch {
        return;
    }

    if (!tokens?.accessToken) return;

    closeGate();

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const success = await attemptValidation();
        if (success) {
            openGate();
            return;
        }

        if (attempt < MAX_ATTEMPTS)
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }

    failGate();

    localStorage.removeItem('auth_tokens');
    localStorage.removeItem('auth_state');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('user_data_cache');

    window.location.href = '/';
}
