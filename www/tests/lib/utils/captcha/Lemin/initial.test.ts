import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LeminCaptcha } from '$lib/utils/captcha/Lemin/initial';

vi.mock('$app/environment', () => ({
    browser: true
}));

describe('LeminCaptcha', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'captcha-container';
        document.body.appendChild(container);
    });
    
    afterEach(() => {
        document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    it('Initialize without key', () => {
        expect(() => new LeminCaptcha('', 'captcha-container')).toThrow('Не указан ключ капчи');
    });

    it('Initialize without container', () => {
        expect(() => new LeminCaptcha('test-key', '')).toThrow('Не указан ID контейнера для капчи');
    });

    it('Render Lemin captcha', async () => {
        const leminCaptcha = new LeminCaptcha('test-key', 'captcha-container');
        
        const scriptLoadPromise = leminCaptcha.render();
        const scriptElement = document.querySelector('script[src*="leminnow.com"]') as HTMLScriptElement;
        expect(scriptElement).toBeTruthy();
        
        scriptElement.onload?.(new Event('load'));
        await scriptLoadPromise;
        expect(leminCaptcha['isLoaded']).toBe(true);
    });

    it('Render Lemin captcha without container', async () => {
        const captcha = new LeminCaptcha('test-key', 'fake-container');
        await expect(captcha.render()).rejects.toThrow('Контейнер с ID fake-container не найден');
    });

    it('Verify before loading captcha', async () => {
        const leminCaptcha = new LeminCaptcha('test-key', 'captcha-container');
        const result = await leminCaptcha.verify();
        expect(result).toEqual({
            success: false,
            errorMessage: "Lemin Captcha не инициализирована"
        });
    });
    
    it('Captcha is verified but not loaded', async () => {
        const leminCaptcha = new LeminCaptcha('test-key', 'captcha-container');
        
        (window as any).LeminCaptcha = undefined;
        
        const result = await leminCaptcha.verify();
        
        expect(result).toEqual({
            success: false,
            errorMessage: 'Lemin Captcha не инициализирована'
        });
    });
});