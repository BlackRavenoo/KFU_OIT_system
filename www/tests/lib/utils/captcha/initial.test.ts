import { describe, it, expect } from 'vitest';
import { Captcha, type CaptchaResult } from '$lib/utils/captcha/initial';

class TestCaptcha extends Captcha {
    public render(): Promise<void> {
        return Promise.resolve();
    }
    public verify(): Promise<CaptchaResult> {
        return Promise.resolve({ success: true, token: 'test-token' });
    }
    public reset(): void {}
    public dispose(): void {}
}

describe('Captcha abstract', () => {
    it('Throw error if key is not provided', () => {
        // @ts-expect-error
        expect(() => new TestCaptcha(undefined, 'container')).toThrow('Не указан ключ капчи');
    });

    it('Throw error if containerId is not provided', () => {
        // @ts-expect-error
        expect(() => new TestCaptcha('key', undefined)).toThrow('Не указан ID контейнера для капчи');
    });

    it('Set key and containerId', () => {
        const captcha = new TestCaptcha('key123', 'container123');
        expect(captcha['key']).toBe('key123');
        expect(captcha['containerId']).toBe('container123');
    });

    it('Returns null if element does not exist', () => {
        const captcha = new TestCaptcha('key', 'not-exist');
        expect(captcha['getContainer']()).toBeNull();
    });

    it('Returns element if exists', () => {
        const div = document.createElement('div');
        div.id = 'test-container';
        document.body.appendChild(div);

        const captcha = new TestCaptcha('key', 'test-container');
        expect(captcha['getContainer']()).toBe(div);

        document.body.removeChild(div);
    });

    it('Render resolves', async () => {
        const captcha = new TestCaptcha('key', 'container');
        await expect(captcha.render()).resolves.toBeUndefined();
    });

    it('Verify resolves with success', async () => {
        const captcha = new TestCaptcha('key', 'container');
        await expect(captcha.verify()).resolves.toEqual({ success: true, token: 'test-token' });
    });

    it('Reset does not throw', () => {
        const captcha = new TestCaptcha('key', 'container');
        expect(() => captcha.reset()).not.toThrow();
    });

    it('Dispose does not throw', () => {
        const captcha = new TestCaptcha('key', 'container');
        expect(() => captcha.dispose()).not.toThrow();
    });
});