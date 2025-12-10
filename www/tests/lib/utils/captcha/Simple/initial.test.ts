import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SimpleCaptcha } from '$lib/utils/captcha/Simple/initial';

function setupContainer() {
    const div = document.createElement('div');
    div.id = 'test-captcha-container';
    document.body.appendChild(div);
    return div;
}

function cleanupContainer() {
    const div = document.getElementById('test-captcha-container');
    if (div) div.remove();
}

describe('SimpleCaptcha', () => {
    let captcha: SimpleCaptcha;
    let container: HTMLElement;

    beforeEach(() => {
        cleanupContainer();
        container = setupContainer();
        captcha = new SimpleCaptcha('test-key', 'test-captcha-container');
    });

    it('Render honeypot input with required attribute', async () => {
        await captcha.render();
        const input = container.querySelector<HTMLInputElement>('#required-name');
        expect(input).toBeTruthy();
        expect(input?.required).toBe(true);
        expect(input?.style.position).toBe('absolute');
        expect(input?.style.left).toBe('-9999px');
    });

    it('Success if honeypot input is empty', async () => {
        await captcha.render();
        const result = await captcha.verify();
        expect(result.success).toBe(true);
        expect(typeof result.token).toBe('string');
    });

    it('Failure if honeypot input is filled', async () => {
        await captcha.render();
        const input = container.querySelector<HTMLInputElement>('#required-name');
        expect(input).toBeTruthy();
        if (input) input.value = 'bot-filled';
        const result = await captcha.verify();
        expect(result.success).toBe(false);
        expect(result.errorMessage).toBe('Обнаружен бот');
    });

    it('Error if honeypot input is missing', async () => {
        const result = await captcha.verify();
        expect(result.success).toBe(false);
        expect(result.errorMessage).toBe('Элемент капчи не найден');
    });

    it('Error if container is missing in verify', async () => {
        cleanupContainer();
        const result = await captcha.verify();
        expect(result.success).toBe(false);
        expect(result.errorMessage).toBe('Контейнер для капчи не найден');
    });

    it('Reset honeypot input value', async () => {
        await captcha.render();
        const input = container.querySelector<HTMLInputElement>('#required-name');
        expect(input).toBeTruthy();
        if (input) input.value = 'something';
        captcha.reset();
        expect(input?.value).toBe('');
    });

    it('Throw error on reset if input is missing', () => {
        expect(() => captcha.reset()).toThrow('Элемент капчи не найден');
    });

    it('Throw error on reset if container is missing', () => {
        cleanupContainer();
        expect(() => captcha.reset()).toThrow('Контейнер для капчи не найден');
    });

    it('Remove input on dispose', async () => {
        await captcha.render();
        captcha.dispose();
        const input = container.querySelector<HTMLInputElement>('#required-name');
        expect(input).toBeFalsy();
    });

    it('Throw error on render if container is missing', async () => {
        cleanupContainer();
        await expect(captcha.render()).rejects.toThrow('Контейнер для капчи не найден');
    });
});