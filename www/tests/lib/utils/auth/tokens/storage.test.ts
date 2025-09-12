import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('LocalStorageTokenStorage', () => {
    const origLocalStorage = globalThis.localStorage;

    beforeEach(() => {
        vi.resetModules();
        globalThis.localStorage = origLocalStorage;
    });

    it('Constructor returns null when stored tokens lack accessToken', async () => {
        globalThis.localStorage = {
            getItem: vi.fn((k: string) => (k === 'auth_tokens' ? JSON.stringify({ refreshToken: 'r' }) : null)),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn()
        } as any;
    
        const mod = await import('$lib/utils/auth/tokens/storage');
        const { LocalStorageTokenStorage } = mod;
        const inst = new LocalStorageTokenStorage();
    
        expect(inst.get()).toBeNull();
    });

    it('Constructor reads valid stored tokens', async () => {
        const stored = { accessToken: 'a', refreshToken: 'r' };
        globalThis.localStorage = {
            getItem: vi.fn((k: string) => (k === 'auth_tokens' ? JSON.stringify(stored) : null)),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn()
        } as any;

        const mod = await import('$lib/utils/auth/tokens/storage');
        const { LocalStorageTokenStorage } = mod;
        const inst = new LocalStorageTokenStorage();

        expect(inst.get()).toEqual(stored);
    });

    it('Constructor handles invalid JSON', async () => {
        const removeSpy = vi.fn();
        globalThis.localStorage = {
            getItem: vi.fn(() => 'not-json'),
            setItem: vi.fn(),
            removeItem: removeSpy,
            clear: vi.fn()
        } as any;

        const mod = await import('$lib/utils/auth/tokens/storage');
        const { LocalStorageTokenStorage } = mod;
        const inst = new LocalStorageTokenStorage();

        expect(inst.get()).toEqual({ accessToken: '', refreshToken: '' });
        expect(removeSpy).toHaveBeenCalledWith('auth_tokens');
    });

    it('Handle errors', async () => {
        const setThrow = vi.fn(() => { throw new Error('no storage'); });
        const removeThrow = vi.fn(() => { throw new Error('no storage'); });
        globalThis.localStorage = {
            getItem: vi.fn(),
            setItem: setThrow,
            removeItem: removeThrow,
            clear: vi.fn()
        } as any;

        const mod = await import('$lib/utils/auth/tokens/storage');
        const { LocalStorageTokenStorage } = mod;
        const inst = new LocalStorageTokenStorage();

        expect(inst.get()).toEqual({ accessToken: '', refreshToken: '' });

        inst.set({ accessToken: 'x', refreshToken: 'y' });
        expect(setThrow).toHaveBeenCalled();
    });

    it('Set tokens persists to localStorage', async () => {
        const storeMap = new Map<string, string>();
        const setSpy = vi.fn((k: string, v: string) => storeMap.set(k, v));
        const removeSpy = vi.fn((k: string) => storeMap.delete(k));
        globalThis.localStorage = {
            getItem: (k: string) => (storeMap.has(k) ? storeMap.get(k) as string : null),
            setItem: setSpy,
            removeItem: removeSpy,
            clear: vi.fn()
        } as any;

        const mod = await import('$lib/utils/auth/tokens/storage');
        const { LocalStorageTokenStorage } = mod;
        const inst = new LocalStorageTokenStorage();

        const tokens = { accessToken: 'at', refreshToken: 'rt' };
        inst.set(tokens);
        expect(inst.get()).toEqual(tokens);
        expect(setSpy).toHaveBeenCalledWith('auth_tokens', JSON.stringify(tokens));

        inst.set(null);
        expect(inst.get()).toBeNull();
        expect(removeSpy).toHaveBeenCalledWith('auth_tokens');
    });

    it('Clear tokens from localStorage', async () => {
        const storeMap = new Map<string, string>();
        const setSpy = vi.fn((k: string, v: string) => storeMap.set(k, v));
        const removeSpy = vi.fn((k: string) => storeMap.delete(k));
        globalThis.localStorage = {
            getItem: (k: string) => (storeMap.has(k) ? storeMap.get(k) as string : null),
            setItem: setSpy,
            removeItem: removeSpy,
            clear: vi.fn()
        } as any;

        const mod = await import('$lib/utils/auth/tokens/storage');
        const { LocalStorageTokenStorage } = mod;
        const inst = new LocalStorageTokenStorage();

        inst.set({ accessToken: 'a', refreshToken: 'b' });
        expect(inst.get()).toEqual({ accessToken: 'a', refreshToken: 'b' });

        inst.clear();
        expect(inst.get()).toBeNull();
        expect(removeSpy).toHaveBeenCalledWith('auth_tokens');
    });

    it('Test helpers', async () => {
        const mod = await import('$lib/utils/auth/tokens/storage');
        const {
            setTokenStorage,
            getTokenStorage,
            getTokenStore,
            setTokenStore,
            clearTokenStore,
            LocalStorageTokenStorage
        } = mod;

        expect(() => getTokenStorage()).toThrow('Token storage is not initialized');

        const store = new LocalStorageTokenStorage();
        setTokenStorage(store);
        expect(getTokenStorage()).toBe(store);

        setTokenStore({ accessToken: 'a', refreshToken: 'b' });
        expect(getTokenStore()).toEqual({ accessToken: 'a', refreshToken: 'b' });

        clearTokenStore();
        expect(getTokenStore()).toBeNull();
    });

    it('Console.warn is calling', async () => {
        const orig = globalThis.localStorage;

        try {
            const storeMap = new Map<string, string>();
            globalThis.localStorage = {
                getItem: (k: string) => (storeMap.has(k) ? storeMap.get(k) as string : null),
                setItem: (k: string, v: string) => storeMap.set(k, v),
                removeItem: (k: string) => storeMap.delete(k),
                clear: () => storeMap.clear()
            } as any;

            const mod = await import('$lib/utils/auth/tokens/storage');
            const { LocalStorageTokenStorage } = mod;
            const inst = new LocalStorageTokenStorage();

            (inst as any).isStorageAvailable = () => true;

            globalThis.localStorage.setItem = () => { throw new Error('set fail'); };
            globalThis.localStorage.removeItem = () => { throw new Error('remove fail'); };

            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            inst.set({ accessToken: 'a', refreshToken: 'b' });
            inst.clear();

            expect(warnSpy).toHaveBeenCalled();
            expect(warnSpy.mock.calls.some(c => String(c[0]).includes('Не удалось сохранить'))).toBeTruthy();
            expect(warnSpy.mock.calls.some(c => String(c[0]).includes('Не удалось очистить'))).toBeTruthy();

            warnSpy.mockRestore();
        } finally {
            globalThis.localStorage = orig;
        }
    });

    it('Aborts when storage unavailable', async () => {
        const orig = globalThis.localStorage;
        try {
            const storeMap = new Map<string, string>();
            const tokens = { accessToken: 'a', refreshToken: 'b' };
            storeMap.set('auth_tokens', JSON.stringify(tokens));

            const removeSpy = vi.fn((k: string) => storeMap.delete(k));
            globalThis.localStorage = {
                getItem: (k: string) => (storeMap.has(k) ? storeMap.get(k) as string : null),
                setItem: (k: string, v: string) => storeMap.set(k, v),
                removeItem: removeSpy,
                clear: () => storeMap.clear()
            } as any;

            const mod = await import('$lib/utils/auth/tokens/storage');
            const { LocalStorageTokenStorage } = mod;
            const inst = new LocalStorageTokenStorage();

            expect(globalThis.localStorage.getItem('auth_tokens')).toEqual(JSON.stringify(tokens));
            expect(inst.get()).toEqual(tokens);

            const callsBeforeClear = removeSpy.mock.calls.length;

            (inst as any).isStorageAvailable = () => false;

            inst.clear();

            expect(removeSpy.mock.calls.length).toBe(callsBeforeClear);
            expect(globalThis.localStorage.getItem('auth_tokens')).toEqual(JSON.stringify(tokens));
        } finally {
            globalThis.localStorage = orig;
        }
    });
});