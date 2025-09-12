import { vi, describe, it, expect } from 'vitest';
import { LocalStorageAuthStore } from '$lib/utils/auth/storage/storage';

describe('LocalStorageAuthStore', () => {
    const testKey = 'testKey';

    it('Set and get a value', () => {
        const orig = globalThis.localStorage;
        try {
            const storeMap = new Map<string, string>();
            globalThis.localStorage = {
                getItem: (k: string) => (storeMap.has(k) ? storeMap.get(k) as string : null),
                setItem: (k: string, v: string) => storeMap.set(k, v),
                removeItem: (k: string) => storeMap.delete(k),
                clear: () => storeMap.clear()
            } as any;

            const store = new LocalStorageAuthStore();
            store.set(testKey, 'testValue');
            expect(store.get(testKey)).toBe('testValue');
        } finally {
            globalThis.localStorage = orig;
        }
    });

    it('Set an empty value', () => {
        const orig = globalThis.localStorage;
        try {
            const storeMap = new Map<string, string>();
            globalThis.localStorage = {
                getItem: (k: string) => (storeMap.has(k) ? storeMap.get(k) as string : null),
                setItem: (k: string, v: string) => storeMap.set(k, v),
                removeItem: (k: string) => storeMap.delete(k),
                clear: () => storeMap.clear()
            } as any;

            const store = new LocalStorageAuthStore();
            store.set(testKey, null);
            expect(store.get(testKey)).toBeNull();
            store.set(testKey, '');
            expect(store.get(testKey)).toBeNull();
        } finally {
            globalThis.localStorage = orig;
        }
    });

    it('Set and clear a value', () => {
        const orig = globalThis.localStorage;
        try {
            const storeMap = new Map<string, string>();
            globalThis.localStorage = {
                getItem: (k: string) => (storeMap.has(k) ? storeMap.get(k) as string : null),
                setItem: (k: string, v: string) => storeMap.set(k, v),
                removeItem: (k: string) => storeMap.delete(k),
                clear: () => storeMap.clear()
            } as any;

            const store = new LocalStorageAuthStore();
            store.set(testKey, 'testValue');
            store.clear(testKey);
            expect(store.get(testKey)).toBeNull();
        } finally {
            globalThis.localStorage = orig;
        }
    });

    it('Catch when set return', () => {
        const orig = globalThis.localStorage;
        try {
            globalThis.localStorage = {
                getItem: vi.fn(),
                setItem: vi.fn(() => { throw new Error('mocked localStorage unavailable'); }),
                removeItem: vi.fn(),
                clear: vi.fn()
            } as any;

            const store = new LocalStorageAuthStore();
            
            expect(() => store.set(testKey, 'value')).not.toThrow();
            expect(store.get(testKey)).toBeNull();
        } finally {
            globalThis.localStorage = orig;
        }
    });

    it('Catch when clear return', () => {
        const orig = globalThis.localStorage;
        try {
            globalThis.localStorage = {
                getItem: vi.fn(),
                setItem: vi.fn(),
                removeItem: vi.fn(() => { throw new Error('mocked localStorage unavailable'); }),
                clear: vi.fn()
            } as any;

            const store = new LocalStorageAuthStore();
            store.set(testKey, 'value');

            expect(() => store.clear(testKey)).not.toThrow();
            expect(store.get(testKey)).toBeNull();
        } finally {
            globalThis.localStorage = orig;
        }
    });

    it('Catch when localStorage.removeItem throws', () => {
        const orig = globalThis.localStorage;
        try {
            const storeMap = new Map<string, string>();

            globalThis.localStorage = {
                getItem: (k: string) => (storeMap.has(k) ? storeMap.get(k) as string : null),
                setItem: (k: string, v: string) => storeMap.set(k, v),
                removeItem: (k: string) => storeMap.delete(k),
                clear: () => storeMap.clear()
            } as any;

            const store = new LocalStorageAuthStore();
            store.set(testKey, 'value');

            globalThis.localStorage = {
                getItem: (k: string) => (storeMap.has(k) ? storeMap.get(k) as string : null),
                setItem: (k: string, v: string) => storeMap.set(k, v),
                removeItem: (k: string) => { throw new Error('mocked localStorage unavailable'); },
                clear: () => storeMap.clear()
            } as any;

            (store as any).isStorageAvailable = () => true;

            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

            expect(() => store.clear(testKey)).not.toThrow();
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringMatching(/Ошибка при удалении данных из localStorage/),
                expect.any(Error)
            );

            warnSpy.mockRestore();
        } finally {
            globalThis.localStorage = orig;
        }
    });

    it('Catch when localStorage.getItem throws', () => {
        const orig = globalThis.localStorage;
        try {
            const storeMap = new Map<string, string>();
        
            globalThis.localStorage = {
                getItem: (k: string) => (storeMap.has(k) ? storeMap.get(k) as string : null),
                setItem: (k: string, v: string) => storeMap.set(k, v),
                removeItem: (k: string) => storeMap.delete(k),
                clear: () => storeMap.clear()
            } as any;
        
            const store = new LocalStorageAuthStore();
            store.set(testKey, 'value');
        
            globalThis.localStorage = {
                getItem: (k: string) => { throw new Error('mocked localStorage unavailable'); },
                setItem: (k: string, v: string) => storeMap.set(k, v),
                removeItem: (k: string) => storeMap.delete(k),
                clear: () => storeMap.clear()
            } as any;
        
            (store as any).isStorageAvailable = () => true;
        
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
            expect(() => store.get(testKey)).not.toThrow();
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringMatching(/Ошибка при получении данных из localStorage/),
                expect.any(Error)
            );
        
            warnSpy.mockRestore();
        } finally {
            globalThis.localStorage = orig;
        }
    });

    it('Catch when localStorage.setItem throws', () => {
        const orig = globalThis.localStorage;
        try {
            const storeMap = new Map<string, string>();
        
            globalThis.localStorage = {
                getItem: (k: string) => (storeMap.has(k) ? storeMap.get(k) as string : null),
                setItem: (k: string, v: string) => storeMap.set(k, v),
                removeItem: (k: string) => storeMap.delete(k),
                clear: () => storeMap.clear()
            } as any;
        
            const store = new LocalStorageAuthStore();
        
            globalThis.localStorage = {
                getItem: (k: string) => (storeMap.has(k) ? storeMap.get(k) as string : null),
                setItem: (k: string, v: string) => { throw new Error('mocked localStorage unavailable'); },
                removeItem: (k: string) => storeMap.delete(k),
                clear: () => storeMap.clear()
            } as any;
        
            (store as any).isStorageAvailable = () => true;
        
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
            expect(() => store.set(testKey, 'value')).not.toThrow();
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringMatching(/Ошибка при сохранении данных в localStorage/),
                expect.any(Error)
            );
        
            warnSpy.mockRestore();
        } finally {
            globalThis.localStorage = orig;
        }
    });
});