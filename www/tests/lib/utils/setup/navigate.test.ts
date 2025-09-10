import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { navigateToHome } from '$lib/utils/setup/navigate';

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

const scrollToMock = vi.fn();

Object.defineProperty(globalThis, 'document', {
    value: {
        cookie: '',
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(),
        getElementById: vi.fn(),
        createElement: vi.fn().mockImplementation(() => ({
            setAttribute: vi.fn(),
            appendChild: vi.fn(),
            offsetTop: 200
        })),
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

import { goto } from '$app/navigation';
import { get } from 'svelte/store';
import { navigateToForm } from '$lib/utils/setup/navigate';

describe('Navigate to Home', () => {
    const originalLocation = window.location;
    let locationMock: { href: any; };

    beforeEach(() => {
        locationMock = { href: '' };
        
        Object.defineProperty(window, 'location', {
            value: locationMock,
            writable: true
        });
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', {
            value: originalLocation,
            writable: true
        });
        
        vi.clearAllTimers();
    });

    it('Redirect to root path', () => {
        const mockEvent = { preventDefault: vi.fn() } as unknown as MouseEvent;
        
        navigateToHome(mockEvent);
        
        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(locationMock.href).toBe('/');     
    });
});

describe.todo('Navigate to Form', () => {
    const originalLocation = window.location;
    let locationMock;

    beforeEach(() => {
        vi.mocked(goto).mockReset();
        vi.mocked(goto).mockImplementation(() => Promise.resolve());
        vi.mocked(get).mockReset();
        scrollToMock.mockReset();
        
        locationMock = { href: '/test' };
        
        Object.defineProperty(window, 'location', {
            value: locationMock,
            writable: true
        });
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', {
            value: originalLocation,
            writable: true
        });
        
        vi.clearAllMocks();
        vi.clearAllTimers();
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
        
        vi.spyOn(document, 'querySelector').mockReturnValueOnce(formElement as any);
        
        vi.useFakeTimers();
        
        navigateToForm();
        
        vi.runAllTimers();
        
        expect(vi.mocked(goto)).not.toHaveBeenCalled();
        expect(scrollToMock).toHaveBeenCalledWith({
            top: 100,
            behavior: 'smooth'
        });
    });
});