import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const scrollToMock = vi.fn();

describe('Navigate to Home', () => {
    let locationMock: { href: string };

    beforeEach(() => {
        vi.resetAllMocks();
        
        Object.defineProperty(globalThis, 'document', {
            value: {
                cookie: '',
                querySelector: vi.fn().mockReturnValue({ scrollIntoView: vi.fn() }),
                querySelectorAll: vi.fn().mockReturnValue([]),
                getElementById: vi.fn(),
                createElement: vi.fn().mockReturnValue({ 
                    setAttribute: vi.fn(),
                    appendChild: vi.fn()
                }),
                body: { appendChild: vi.fn() },
                location: { href: 'http://localhost:3000/' }
            },
            writable: true
        });
        
        Object.defineProperty(globalThis, 'window', {
            value: {
                document: globalThis.document,
                location: { href: 'http://localhost:3000/' },
                scrollTo: scrollToMock,
                setTimeout: globalThis.setTimeout,
                clearTimeout: globalThis.clearTimeout,
                localStorage: {
                    getItem: vi.fn(),
                    setItem: vi.fn(),
                    removeItem: vi.fn()
                },
                sessionStorage: {
                    getItem: vi.fn(),
                    setItem: vi.fn(),
                    removeItem: vi.fn()
                }
            },
            writable: true
        });
        
        locationMock = { href: '' };
        
        Object.defineProperty(document, 'location', {
            value: locationMock,
            writable: true
        });
        
        Object.defineProperty(window, 'location', {
            value: locationMock,
            writable: true
        });
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.restoreAllMocks();
    });

    it('Redirect to root path', () => {
        const mockEvent = { preventDefault: vi.fn() } as unknown as MouseEvent;
        
        navigateToHome(mockEvent);
        
        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(locationMock.href).toBe('/');     
    });
});

describe('Navigate to Form', () => {
    let locationMock: { href: string };

    beforeEach(() => {
        vi.resetAllMocks();
        scrollToMock.mockReset();
        vi.mocked(goto).mockReset();
        vi.mocked(goto).mockImplementation(() => Promise.resolve());
        vi.mocked(get).mockReset();
        
        Object.defineProperty(globalThis, 'document', {
            value: {
                cookie: '',
                querySelector: vi.fn().mockReturnValue({ scrollIntoView: vi.fn() }),
                querySelectorAll: vi.fn().mockReturnValue([]),
                getElementById: vi.fn(),
                createElement: vi.fn().mockReturnValue({ 
                    setAttribute: vi.fn(),
                    appendChild: vi.fn()
                }),
                body: { appendChild: vi.fn() },
                location: { href: 'http://localhost:3000/' }
            },
            writable: true
        });
        
        Object.defineProperty(globalThis, 'window', {
            value: {
                document: globalThis.document,
                location: { href: 'http://localhost:3000/' },
                scrollTo: scrollToMock,
                setTimeout: globalThis.setTimeout,
                clearTimeout: globalThis.clearTimeout,
                localStorage: {
                    getItem: vi.fn(),
                    setItem: vi.fn(),
                    removeItem: vi.fn()
                },
                sessionStorage: {
                    getItem: vi.fn(),
                    setItem: vi.fn(),
                    removeItem: vi.fn()
                }
            },
            writable: true
        });
        locationMock = { href: '/test' };
        
        Object.defineProperty(document, 'location', {
            value: locationMock,
            writable: true
        });
        
        Object.defineProperty(window, 'location', {
            value: locationMock,
            writable: true
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.clearAllTimers();
        vi.restoreAllMocks();
    });

    it('Redirects using goto function', async () => {
        vi.mocked(get).mockReturnValue({ url: { pathname: '/not-home' } });
        
        await navigateToForm();
        
        expect(vi.mocked(goto)).toHaveBeenCalledWith('/');
    });

    it('Scrolls to form element if on home page', async () => {
        vi.mocked(get).mockReturnValue({ url: { pathname: '/' } });
        
        const formElement = {
            offsetTop: 200,
            scrollIntoView: vi.fn()
        };

        document.getElementById = vi.fn().mockReturnValue(formElement);

        vi.useFakeTimers();
        navigateToForm();
        vi.runAllTimers();

        expect(vi.mocked(goto)).not.toHaveBeenCalled();
        expect(scrollToMock).toHaveBeenCalledWith({
            top: 100,
            behavior: 'smooth'
        });
    });

    it('When no form element present', async () => {
        vi.resetModules();

        const gotoMock = vi.fn(() => Promise.resolve());
        vi.doMock('$app/navigation', () => ({ goto: gotoMock }));
        vi.doMock('$app/stores', () => ({ page: {} }));
        vi.doMock('svelte/store', () => ({ get: () => ({ url: { pathname: '/not-home' } }) }));

        (globalThis as any).window = (globalThis as any).window || {};
        const scrollSpy = vi.fn();
        (globalThis as any).window.scrollTo = scrollSpy;
        document.getElementById = vi.fn().mockReturnValue(null);

        let capturedCb: Function | null = null;
        let capturedDelay: number | undefined;
        // @ts-ignore
        const setTimeoutSpy = vi.spyOn(globalThis as any, 'setTimeout').mockImplementation((cb: any, delay?: number) => {
            capturedCb = cb;
            capturedDelay = delay;
            return 1 as any;
        });

        try {
            const { navigateToForm } = await import('$lib/utils/setup/navigate');
            navigateToForm();
            await Promise.resolve();

            expect(gotoMock).toHaveBeenCalledWith('/');
            expect(setTimeoutSpy).toHaveBeenCalled();
            expect(capturedDelay).toBe(100);
            expect(typeof capturedCb).toBe('function');

            // @ts-ignore
            (capturedCb as Function)();

            expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
        } finally {
            setTimeoutSpy.mockRestore();
            vi.resetModules();
            vi.doUnmock('$app/navigation');
            vi.doUnmock('$app/stores');
            vi.doUnmock('svelte/store');
        }
    });
});

vi.mock('$app/navigation', () => {
    return {
        goto: vi.fn(() => Promise.resolve())
    };
});

vi.mock('$app/stores', () => {
    return {
        page: {
            subscribe: vi.fn((callback) => {
                callback({ url: { pathname: '/some-path' } });
                return () => {}; 
            })
        }
    };
});

vi.mock('svelte/store', () => {
    return {
        get: vi.fn()
    };
});

import { goto } from '$app/navigation';
import { get } from 'svelte/store';
import { navigateToHome, navigateToForm } from '$lib/utils/setup/navigate';