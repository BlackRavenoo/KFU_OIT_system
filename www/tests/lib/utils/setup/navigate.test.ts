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

import { goto } from '$app/navigation';
import { get } from 'svelte/store';
import { navigateToForm } from '$lib/utils/setup/navigate';

describe('Navigate to Home', () => {
    const originalLocation = window.location;
    let locationMock: any;

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
    });

    it('Redirect to root path', () => {
        const mockEvent = { preventDefault: vi.fn() } as unknown as MouseEvent;
        
        navigateToHome(mockEvent);
        
        expect(mockEvent.preventDefault).toHaveBeenCalled();
        expect(locationMock.href).toBe('/');     
    });
});

describe('Navigate to Form', () => {
    const originalLocation = window.location;
    let locationMock: any;

    beforeEach(() => {
        vi.mocked(goto).mockReset();
        vi.mocked(goto).mockImplementation(() => Promise.resolve());
        vi.mocked(get).mockReset();
        
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
    });

    it('Redirects using goto function', async () => {
        vi.mocked(get).mockReturnValue({ url: { pathname: '/not-home' } });
        
        await navigateToForm();
        
        expect(vi.mocked(goto)).toHaveBeenCalledWith('/');
    });

    it('Scrolls to form element if on home page', async () => {
        vi.mocked(get).mockReturnValue({ url: { pathname: '/' } });
        
        const formElement = document.createElement('div');
        formElement.id = 'form';
        Object.defineProperty(formElement, 'offsetTop', { value: 200 });
        document.body.appendChild(formElement);
        
        // Создаем шпион для window.scrollTo
        const scrollToSpy = vi.spyOn(window, 'scrollTo');
        
        // Используем фейковые таймеры для контроля setTimeout
        vi.useFakeTimers();
        
        // Вызываем функцию
        navigateToForm();
        
        // Запускаем отложенные таймеры
        vi.runAllTimers();
        
        // Проверяем, что goto не вызывался (т.к. мы уже на главной странице)
        expect(vi.mocked(goto)).not.toHaveBeenCalled();
        
        // Проверяем, что scrollTo вызван с правильными параметрами
        expect(scrollToSpy).toHaveBeenCalledWith({
            top: 100, // 200 (offsetTop) - 100
            behavior: 'smooth'
        });
        
        // Очистка
        document.body.removeChild(formElement);
        scrollToSpy.mockRestore();
        vi.useRealTimers();
    });
});