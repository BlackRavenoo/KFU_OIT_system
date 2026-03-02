
import { describe } from 'node:test';
import { it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$lib/utils/auth/tokens/storage', () => ({ setTokenStore: vi.fn() }));
vi.mock('$lib/utils/auth/tokens/tokens', () => ({ isTokenValid: vi.fn() }));
vi.mock('@fingerprintjs/fingerprintjs', () => { const load = vi.fn(); return { default: { load } }; });

const localStorageMock = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() };
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
const fetchMock = vi.fn();
Object.defineProperty(globalThis, 'fetch', { value: fetchMock, writable: true });
Object.defineProperty(globalThis, 'window', { value: { location: { href: '' } }, writable: true });

const storageModule = await import('$lib/utils/auth/tokens/storage');
const tokensModule = await import('$lib/utils/auth/tokens/tokens');
const FingerprintJS = await import('@fingerprintjs/fingerprintjs');

function makeTokensJson(accessToken = 'access', refreshToken = 'refresh') {
    return JSON.stringify({ accessToken, refreshToken });
}

async function freshGate() {
    vi.resetModules();
    vi.doMock('$lib/utils/auth/tokens/storage', () => ({ setTokenStore: vi.fn() }));
    vi.doMock('$lib/utils/auth/tokens/tokens', () => ({ isTokenValid: (tokensModule as any).isTokenValid }));
    vi.doMock('@fingerprintjs/fingerprintjs', () => ({ default: (FingerprintJS as any).default }));
    return import('$lib/utils/auth/api/requestGate');
}

beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    fetchMock.mockReset();
    (globalThis as any).window.location.href = '';
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('requestGate', () => {
    it('Returns false for undefined url', async () => {
        const { isAuthBypassUrl } = await import('$lib/utils/auth/api/requestGate');
        expect(isAuthBypassUrl(undefined)).toBe(false);
    });

    it('Returns false for empty string', async () => {
        const { isAuthBypassUrl } = await import('$lib/utils/auth/api/requestGate');
        expect(isAuthBypassUrl('')).toBe(false);
    });

    it('Returns true for /api/v1/auth/login', async () => {
        const { isAuthBypassUrl } = await import('$lib/utils/auth/api/requestGate');
        expect(isAuthBypassUrl('/api/v1/auth/login')).toBe(true);
    });

    it('Returns true for /api/v1/auth/token', async () => {
        const { isAuthBypassUrl } = await import('$lib/utils/auth/api/requestGate');
        expect(isAuthBypassUrl('/api/v1/auth/token')).toBe(true);
    });

    it('Returns true for full url with auth path', async () => {
        const { isAuthBypassUrl } = await import('$lib/utils/auth/api/requestGate');
        expect(isAuthBypassUrl('https://example.com/api/v1/auth/me')).toBe(true);
    });

    it('Returns false for /api/v1/tickets/', async () => {
        const { isAuthBypassUrl } = await import('$lib/utils/auth/api/requestGate');
        expect(isAuthBypassUrl('/api/v1/tickets/')).toBe(false);
    });

    it('Returns false for /api/v1/auth-related', async () => {
        const { isAuthBypassUrl } = await import('$lib/utils/auth/api/requestGate');
        expect(isAuthBypassUrl('/api/v1/auth-related')).toBe(false);
    });

    it('Adds leading slash to relative path', async () => {
        const { isAuthBypassUrl } = await import('$lib/utils/auth/api/requestGate');
        expect(isAuthBypassUrl('api/v1/auth/me')).toBe(true);
    });

    it('Returns false for invalid url', async () => {
        const { isAuthBypassUrl } = await import('$lib/utils/auth/api/requestGate');
        expect(isAuthBypassUrl(':::invalid:::')).toBe(false);
    });

    it('Gate is open by default', async () => {
        const { isGateOpen } = await import('$lib/utils/auth/api/requestGate');
        expect(isGateOpen()).toBe(true);
    });

    it('WaitForGate resolves true if gate is open', async () => {
        const { waitForGate } = await import('$lib/utils/auth/api/requestGate');
        await expect(waitForGate()).resolves.toBe(true);
    });

    it('Does nothing if window is undefined', async () => {
        const gate = await freshGate();
        const windowBak = (globalThis as any).window;
        (globalThis as any).window = undefined;
        await gate.initRequestGate();
        expect(gate.isGateOpen()).toBe(true);
        (globalThis as any).window = windowBak;
    });

    it('Does nothing if no auth_tokens in localStorage', async () => {
        const gate = await freshGate();
        localStorageMock.getItem.mockReturnValue(null);
        await gate.initRequestGate();
        expect(gate.isGateOpen()).toBe(true);
    });

    it('Does nothing if auth_tokens is invalid JSON', async () => {
        const gate = await freshGate();
        localStorageMock.getItem.mockReturnValue('{bad json}');
        await gate.initRequestGate();
        expect(gate.isGateOpen()).toBe(true);
    });

    it('Does nothing if no accessToken in object', async () => {
        const gate = await freshGate();
        localStorageMock.getItem.mockReturnValue(JSON.stringify({ refreshToken: 'r' }));
        await gate.initRequestGate();
        expect(gate.isGateOpen()).toBe(true);
    });

    it('Opens gate after successful access token validation on server', async () => {
        const gate = await freshGate();
        const { isTokenValid } = await import('$lib/utils/auth/tokens/tokens');
        localStorageMock.getItem.mockImplementation((key) => key === 'auth_tokens' ? makeTokensJson('valid-access', 'valid-refresh') : null);
        vi.mocked(isTokenValid).mockReturnValue(true);
        fetchMock.mockResolvedValue({ ok: true });
        await gate.initRequestGate();
        expect(gate.isGateOpen()).toBe(true);
        await expect(gate.waitForGate()).resolves.toBe(true);
    });

    it('WaitForGate resolves true after gate opens', async () => {
        const gate = await freshGate();
        const { isTokenValid } = await import('$lib/utils/auth/tokens/tokens');
        localStorageMock.getItem.mockImplementation((key) => key === 'auth_tokens' ? makeTokensJson() : null);
        vi.mocked(isTokenValid).mockReturnValue(true);
        fetchMock.mockResolvedValue({ ok: true });
        const waitPromise = gate.waitForGate();
        await gate.initRequestGate();
        await expect(waitPromise).resolves.toBe(true);
    });

    it('Opens gate if access token is expired but refresh is successful', async () => {
        const gate = await freshGate();
        const { isTokenValid } = await import('$lib/utils/auth/tokens/tokens');
        const { setTokenStore } = await import('$lib/utils/auth/tokens/storage');
        const FP = await import('@fingerprintjs/fingerprintjs');
        localStorageMock.getItem.mockImplementation((key) => key === 'auth_tokens' ? makeTokensJson('expired-access', 'valid-refresh') : null);
        vi.mocked(isTokenValid).mockReturnValue(false);
        const fpGet = vi.fn().mockResolvedValue({ visitorId: 'fp-123' });
        (FP.default as any).load.mockResolvedValue({ get: fpGet });
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh' }) });
        await gate.initRequestGate();
        expect(gate.isGateOpen()).toBe(true);
        expect(vi.mocked(setTokenStore)).toHaveBeenCalledWith({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    });

    it('Opens gate if server denied access but refresh is successful', async () => {
        const gate = await freshGate();
        const { isTokenValid } = await import('$lib/utils/auth/tokens/tokens');
        const { setTokenStore } = await import('$lib/utils/auth/tokens/storage');
        const FP = await import('@fingerprintjs/fingerprintjs');
        localStorageMock.getItem.mockImplementation((key) => key === 'auth_tokens' ? makeTokensJson('access', 'refresh') : null);
        vi.mocked(isTokenValid).mockReturnValue(true);
        const fpGet = vi.fn().mockResolvedValue({ visitorId: 'fp-abc' });
        (FP.default as any).load.mockResolvedValue({ get: fpGet });
        fetchMock.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'refreshed-access', refresh_token: 'refreshed-refresh' }) });
        await gate.initRequestGate();
        expect(gate.isGateOpen()).toBe(true);
        expect(vi.mocked(setTokenStore)).toHaveBeenCalledWith({ accessToken: 'refreshed-access', refreshToken: 'refreshed-refresh' });
    });

    it('Closes gate and clears localStorage after 3 failed attempts', async () => {
        const gate = await freshGate();
        const { isTokenValid } = await import('$lib/utils/auth/tokens/tokens');
        const FP = await import('@fingerprintjs/fingerprintjs');
        localStorageMock.getItem.mockImplementation((key) => key === 'auth_tokens' ? makeTokensJson('access', 'refresh') : null);
        vi.mocked(isTokenValid).mockReturnValue(false);
        const fpGet = vi.fn().mockResolvedValue({ visitorId: 'fp-fail' });
        (FP.default as any).load.mockResolvedValue({ get: fpGet });
        fetchMock.mockResolvedValue({ ok: false });
        const initPromise = gate.initRequestGate();
        await vi.runAllTimersAsync();
        await initPromise;
        expect(gate.isGateOpen()).toBe(true);
        await expect(gate.waitForGate()).resolves.toBe(true);
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_tokens');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_state');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_user');
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('user_data_cache');
        expect((globalThis as any).window.location.href).toBe('/');
    });

    it('WaitForGate resolves false when gate failed', async () => {
        const gate = await freshGate();
        const { isTokenValid } = await import('$lib/utils/auth/tokens/tokens');
        const FP = await import('@fingerprintjs/fingerprintjs');
        localStorageMock.getItem.mockImplementation((key) => key === 'auth_tokens' ? makeTokensJson('access', 'refresh') : null);
        vi.mocked(isTokenValid).mockReturnValue(false);
        const fpGet = vi.fn().mockResolvedValue({ visitorId: 'fp-fail2' });
        (FP.default as any).load.mockResolvedValue({ get: fpGet });
        fetchMock.mockResolvedValue({ ok: false });
        const initPromise = gate.initRequestGate();
        const waitPromise = gate.waitForGate();
        await vi.runAllTimersAsync();
        await initPromise;
        await expect(waitPromise).resolves.toBe(false);
    });

    it('Makes exactly 3 attempts before giving up', async () => {
        const gate = await freshGate();
        const { isTokenValid } = await import('$lib/utils/auth/tokens/tokens');
        const FP = await import('@fingerprintjs/fingerprintjs');
        localStorageMock.getItem.mockImplementation((key) => key === 'auth_tokens' ? makeTokensJson('access', 'refresh') : null);
        vi.mocked(isTokenValid).mockReturnValue(false);
        const fpGet = vi.fn().mockResolvedValue({ visitorId: 'fp-x' });
        (FP.default as any).load.mockResolvedValue({ get: fpGet });
        fetchMock.mockResolvedValue({ ok: false });
        const initPromise = gate.initRequestGate();
        await vi.runAllTimersAsync();
        await initPromise;
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('Does not clear localStorage if no auth_tokens initially', async () => {
        const gate = await freshGate();
        localStorageMock.getItem.mockReturnValue(null);
        await gate.initRequestGate();
        expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    });

    it('Opens gate on second attempt', async () => {
        const gate = await freshGate();
        const { isTokenValid } = await import('$lib/utils/auth/tokens/tokens');
        const FP = await import('@fingerprintjs/fingerprintjs');
        localStorageMock.getItem.mockImplementation((key) => key === 'auth_tokens' ? makeTokensJson('access', 'refresh') : null);
        vi.mocked(isTokenValid).mockReturnValue(false);
        const fpGet = vi.fn().mockResolvedValue({ visitorId: 'fp-retry' });
        (FP.default as any).load.mockResolvedValue({ get: fpGet });
        fetchMock.mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'new-a', refresh_token: 'new-r' }) });
        const initPromise = gate.initRequestGate();
        await vi.runAllTimersAsync();
        await initPromise;
        expect(gate.isGateOpen()).toBe(true);
        await expect(gate.waitForGate()).resolves.toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('Does not make a 4th attempt', async () => {
        const gate = await freshGate();
        const { isTokenValid } = await import('$lib/utils/auth/tokens/tokens');
        const FP = await import('@fingerprintjs/fingerprintjs');
        localStorageMock.getItem.mockImplementation((key) => key === 'auth_tokens' ? makeTokensJson('access', 'refresh') : null);
        vi.mocked(isTokenValid).mockReturnValue(false);
        const fpGet = vi.fn().mockResolvedValue({ visitorId: 'fp-4' });
        (FP.default as any).load.mockResolvedValue({ get: fpGet });
        fetchMock.mockResolvedValue({ ok: false });
        const initPromise = gate.initRequestGate();
        await vi.runAllTimersAsync();
        await initPromise;
        expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(3);
    });

    it('Handles network error during validation without crash', async () => {
        const gate = await freshGate();
        const { isTokenValid } = await import('$lib/utils/auth/tokens/tokens');
        localStorageMock.getItem.mockImplementation((key) => key === 'auth_tokens' ? makeTokensJson() : null);
        vi.mocked(isTokenValid).mockReturnValue(true);
        fetchMock.mockRejectedValue(new Error('Network error'));
        const initPromise = gate.initRequestGate();
        await vi.runAllTimersAsync();
        await initPromise;
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_tokens');
    });

    it('Handles network error during token refresh', async () => {
        const gate = await freshGate();
        const { isTokenValid } = await import('$lib/utils/auth/tokens/tokens');
        const FP = await import('@fingerprintjs/fingerprintjs');
        localStorageMock.getItem.mockImplementation((key) => key === 'auth_tokens' ? makeTokensJson() : null);
        vi.mocked(isTokenValid).mockReturnValue(false);
        const fpGet = vi.fn().mockResolvedValue({ visitorId: 'fp-err' });
        (FP.default as any).load.mockResolvedValue({ get: fpGet });
        fetchMock.mockRejectedValue(new Error('Network error'));
        const initPromise = gate.initRequestGate();
        await vi.runAllTimersAsync();
        await initPromise;
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_tokens');
    });

    it('Second init call does not create a new gate promise when gate is already closed', async () => {
        const gate = await freshGate();
        const { isTokenValid } = await import('$lib/utils/auth/tokens/tokens');
        const FP = await import('@fingerprintjs/fingerprintjs');
        localStorageMock.getItem.mockImplementation((key) => key === 'auth_tokens' ? makeTokensJson('access', 'refresh') : null);
        vi.mocked(isTokenValid).mockReturnValue(false);
        const fpGet = vi.fn().mockResolvedValue({ visitorId: 'fp-double' });
        (FP.default as any).load.mockResolvedValue({ get: fpGet });
        fetchMock.mockResolvedValue({ ok: false });
        const firstInit = gate.initRequestGate();
        await vi.advanceTimersByTimeAsync(0);
        expect(gate.isGateOpen()).toBe(false);
        const waitPromise = gate.waitForGate();
        const secondInit = gate.initRequestGate();
        expect(gate.isGateOpen()).toBe(false);
        await vi.runAllTimersAsync();
        await Promise.allSettled([firstInit, secondInit]);
        await expect(waitPromise).resolves.toBe(false);
    });

    it('Warns when gate is opened without a pending promise', async () => {
        const gate = await freshGate();
        const { isTokenValid } = await import('$lib/utils/auth/tokens/tokens');
        const FP = await import('@fingerprintjs/fingerprintjs');
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        localStorageMock.getItem.mockImplementation((key) => key === 'auth_tokens' ? makeTokensJson('valid-access', 'valid-refresh') : null);
        vi.mocked(isTokenValid).mockReturnValue(true);
        fetchMock.mockResolvedValue({ ok: true });
        const first = gate.initRequestGate();
        const second = gate.initRequestGate();
        await Promise.all([first, second]);
        expect(warnSpy).toHaveBeenCalledWith('Request gate opened without pending promise');
        warnSpy.mockRestore();
    });

    it('Resolves true when gate is closed but promise is null', async () => {
        const gate = await freshGate();
        expect(gate.isGateOpen()).toBe(true);
        await expect(gate.waitForGate()).resolves.toBe(true);
    });

    it('Falls back to raw url when url parsing throws', async () => {
        const { isAuthBypassUrl } = await import('$lib/utils/auth/api/requestGate');
        expect(isAuthBypassUrl('https://\x00/api/v1/auth/me')).toBe(false);
    });

    it('Warns when refresh response is missing tokens', async () => {
        const gate = await freshGate();
        const { isTokenValid } = await import('$lib/utils/auth/tokens/tokens');
        const FP = await import('@fingerprintjs/fingerprintjs');
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        localStorageMock.getItem.mockImplementation((key) => key === 'auth_tokens' ? makeTokensJson('access', 'refresh') : null);
        vi.mocked(isTokenValid).mockReturnValue(false);
        const fpGet = vi.fn().mockResolvedValue({ visitorId: 'fp-warn' });
        (FP.default as any).load.mockResolvedValue({ get: fpGet });
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ access_token: null, refresh_token: null }) });
        const initPromise = gate.initRequestGate();
        await vi.runAllTimersAsync();
        await initPromise;
        expect(warnSpy).toHaveBeenCalledWith('Refresh response missing tokens');
        warnSpy.mockRestore();
    });

    it('Fails all attempts and clears storage when tokens removed before validation', async () => {
        const gate = await freshGate();
        const { isTokenValid } = await import('$lib/utils/auth/tokens/tokens');
        localStorageMock.getItem
            .mockReturnValueOnce(makeTokensJson())
            .mockReturnValue(null);
        vi.mocked(isTokenValid).mockReturnValue(false);
        const initPromise = gate.initRequestGate();
        const waitPromise = gate.waitForGate();
        await vi.runAllTimersAsync();
        await initPromise;
        expect(gate.isGateOpen()).toBe(true);
        await expect(waitPromise).resolves.toBe(false);
    });

    it('Returns false when stored tokens are invalid json during validation', async () => {
        const gate = await freshGate();
        localStorageMock.getItem
            .mockReturnValueOnce(makeTokensJson())
            .mockReturnValueOnce(makeTokensJson())
            .mockReturnValue('{bad json}');
        const initPromise = gate.initRequestGate();
        const waitPromise = gate.waitForGate();
        await vi.runAllTimersAsync();
        await initPromise;
        await expect(waitPromise).resolves.toBe(false);
    });

    it('Fails all attempts when parsed tokens have no access token during validation', async () => {
        const gate = await freshGate();
        localStorageMock.getItem
            .mockReturnValueOnce(makeTokensJson())
            .mockReturnValue(JSON.stringify({ refreshToken: 'refresh' }));
        const initPromise = gate.initRequestGate();
        const waitPromise = gate.waitForGate();
        await vi.runAllTimersAsync();
        await initPromise;
        await expect(waitPromise).resolves.toBe(false);
    });

    it('Warns when no refresh token is available during validation', async () => {
        const gate = await freshGate();
        const { isTokenValid } = await import('$lib/utils/auth/tokens/tokens');
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        localStorageMock.getItem.mockImplementation((key) => key === 'auth_tokens' ? JSON.stringify({ accessToken: 'access' }) : null);
        vi.mocked(isTokenValid).mockReturnValue(false);
        const initPromise = gate.initRequestGate();
        const waitPromise = gate.waitForGate();
        await vi.runAllTimersAsync();
        await initPromise;
        expect(warnSpy).toHaveBeenCalledWith('No refresh token available for validation attempt');
        await expect(waitPromise).resolves.toBe(false);
        warnSpy.mockRestore();
    });
});