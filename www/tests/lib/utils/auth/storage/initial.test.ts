import { vi, describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';

describe('Auth Storage Initialization', () => {
    beforeEach(() => {
        localStorage.clear?.();
        sessionStorage.clear?.();
        vi.resetModules();
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('Does nothing when browser', async () => {
        vi.doMock('$app/environment', () => ({ browser: false }));

        const getSpy = vi.fn();
        const setSpy = vi.fn();
        const clearSpy = vi.fn();

        vi.doMock('$lib/utils/auth/storage/storage', () => ({
            // use a real constructor (not an arrow) so `new LocalStorageAuthStore()` works
            LocalStorageAuthStore: function () {
                return { get: getSpy, set: setSpy, clear: clearSpy };
            }
        }));

        const mod = await import('$lib/utils/auth/storage/initial');
        const { initializeAuth, currentUser, isAuthenticated } = mod;
        const res = initializeAuth();

        expect(res.initialUserData).toBeNull();
        expect(res.initialAuthState).toBe(false);
        expect(get(currentUser)).toBeNull();
        expect(get(isAuthenticated)).toBe(false);
        expect(getSpy).not.toHaveBeenCalled();
        expect(setSpy).not.toHaveBeenCalled();
        expect(clearSpy).not.toHaveBeenCalled();
    });

    it('Clears invalid stored values', async () => {
        vi.doMock('$app/environment', () => ({ browser: true }));

        const getSpy = vi.fn()
            .mockImplementationOnce(() => null) 
            .mockImplementationOnce(() => null);
        const setSpy = vi.fn();
        const clearSpy = vi.fn();

        vi.doMock('$lib/utils/auth/storage/storage', () => ({
            LocalStorageAuthStore: function () {
                return { get: getSpy, set: setSpy, clear: clearSpy };
            }
        }));

        const mod = await import('$lib/utils/auth/storage/initial');
        const { initializeAuth, currentUser, isAuthenticated } = mod;
        const res = initializeAuth();

        expect(res.initialUserData).toBeNull();
        expect(res.initialAuthState).toBe(false);
        expect(clearSpy).toHaveBeenCalledWith('auth_state');
        expect(clearSpy).toHaveBeenCalledWith('auth_user');

        currentUser.set(res.initialUserData);
        isAuthenticated.set(res.initialAuthState);
        expect(get(currentUser)).toBeNull();
        expect(get(isAuthenticated)).toBe(false);
    });

    it('Loads stored values and wires subscriptions to persist changes', async () => {
        vi.doMock('$app/environment', () => ({ browser: true }));

        const user = { id: 1, name: 'Test User' };
        const getSpy = vi.fn()
            .mockImplementationOnce(() => JSON.stringify(true))
            .mockImplementationOnce(() => JSON.stringify(user));
        const setSpy = vi.fn();
        const clearSpy = vi.fn();

        vi.doMock('$lib/utils/auth/storage/storage', () => ({
            LocalStorageAuthStore: function () {
                return { get: getSpy, set: setSpy, clear: clearSpy };
            }
        }));

        const mod = await import('$lib/utils/auth/storage/initial');
        const { initializeAuth, currentUser, isAuthenticated } = mod;
        const res = initializeAuth();

        expect(res.initialUserData).toEqual(user);
        expect(res.initialAuthState).toBe(true);

        currentUser.set(res.initialUserData);
        isAuthenticated.set(res.initialAuthState);

        expect(setSpy).toHaveBeenCalledWith('auth_user', JSON.stringify(user));
        expect(setSpy).toHaveBeenCalledWith('auth_state', JSON.stringify(true));

        currentUser.set(null);
        expect(clearSpy).toHaveBeenCalledWith('auth_user');

        isAuthenticated.set(false);
        expect(setSpy).toHaveBeenCalledWith('auth_state', JSON.stringify(false));
    });

    it('Handles exceptions', async () => {
        vi.doMock('$app/environment', () => ({ browser: true }));

        const getSpy = vi.fn().mockImplementation(() => { throw new Error('boom'); });
        const setSpy = vi.fn();
        const clearSpy = vi.fn();

        vi.doMock('$lib/utils/auth/storage/storage', () => ({
            LocalStorageAuthStore: function () {
                return { get: getSpy, set: setSpy, clear: clearSpy };
            }
        }));

        const mod = await import('$lib/utils/auth/storage/initial');
        const { initializeAuth } = mod;
        const res = initializeAuth();

        expect(res.initialUserData).toBeNull();
        expect(res.initialAuthState).toBe(false);
        expect(clearSpy).toHaveBeenCalledWith('auth_state');
        expect(clearSpy).toHaveBeenCalledWith('auth_user');
    });
});