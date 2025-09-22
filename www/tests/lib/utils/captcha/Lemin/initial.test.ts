import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LeminCaptcha } from '$lib/utils/captcha/Lemin/initial';

describe('LeminCaptcha', () => {
    const key = 'test-key';
    const containerId = 'test-container';
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = containerId;
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
        delete window.leminCroppedCaptcha;
    });

    it('Throw error if container not found', async () => {
        const captcha = new LeminCaptcha(key, 'wrong-id');
        await expect(captcha.render()).rejects.toThrow(/Контейнер с ID/);
    });

    it('Inject script and resolve on load', async () => {
        const captcha = new LeminCaptcha(key, containerId);
        const appendChildSpy = vi.spyOn(container.parentNode as Node, 'appendChild').mockImplementation((el: any) => {
            setTimeout(() => el.onload(), 0);
            return el;
        });

        const injectStylesSpy = vi.spyOn<any, any>(captcha as any, 'injectCaptchaStyles');
        await captcha.render();

        expect(appendChildSpy).toHaveBeenCalled();
        expect(injectStylesSpy).toHaveBeenCalled();
    });

    it('Reject on script error', async () => {
        const captcha = new LeminCaptcha(key, containerId);

        vi.spyOn(container.parentNode as Node, 'appendChild').mockImplementation((el: any) => {
            setTimeout(() => el.onerror('fail'), 0);
            return el;
        });

        await expect(captcha.render()).rejects.toThrow(/Не удалось загрузить Lemin Captcha/);
    });

    it('Reject if exception thrown in render', async () => {
        const captcha = new LeminCaptcha(key, containerId);
        const origCreateElement = document.createElement;
        vi.spyOn(document, 'createElement').mockImplementation(() => {
            throw new Error('Test createElement error');
        });

        await expect(captcha.render()).rejects.toThrow('Test createElement error');

        document.createElement = origCreateElement;
    });

    it('Returns error if not loaded', async () => {
        const captcha = new LeminCaptcha(key, containerId);
        const result = await captcha.verify();
        expect(result.success).toBe(false);
        expect(result.errorMessage).toMatch(/не инициализирована/i);
    });

    it('Returns error if no captcha values', async () => {
        const captcha = new LeminCaptcha(key, containerId);
        // @ts-ignore
        captcha.isLoaded = true;
        const getCaptchaValuesSpy = vi.spyOn(captcha as any, 'getCaptchaValues').mockReturnValue(null);

        const result = await captcha.verify();
        expect(getCaptchaValuesSpy).toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.errorMessage).toMatch(/Не удалось получить значения/);
    });

    it('Returns success if captcha values present', async () => {
        const captcha = new LeminCaptcha(key, containerId);
        // @ts-ignore
        captcha.isLoaded = true;
        const values = { challenge_id: 'cid', answer: 'ans' };
        vi.spyOn(captcha as any, 'getCaptchaValues').mockReturnValue(values);

        const result = await captcha.verify();
        expect(result.success).toBe(true);
        expect(result.token).toBe(JSON.stringify(values));
    });

    it('Returns error if captcha values incomplete', async () => {
        const captcha = new LeminCaptcha(key, containerId);
        // @ts-ignore
        captcha.isLoaded = true;
        vi.spyOn(captcha as any, 'getCaptchaValues').mockReturnValue({ challenge_id: '', answer: '' });

        const result = await captcha.verify();
        expect(result.success).toBe(false);
        expect(result.errorMessage).toMatch(/Пожалуйста, пройдите проверку/);
    });

    it('Returns null if leminCroppedCaptcha missing', () => {
        const captcha = new LeminCaptcha(key, containerId);
        expect(captcha['getCaptchaValues']()).toBeNull();
    });

    it('Returns null if getCaptcha is not a function', () => {
        // @ts-ignore
        window.leminCroppedCaptcha = { getCaptcha: 123 };
        const captcha = new LeminCaptcha(key, containerId);
        expect(captcha['getCaptchaValues']()).toBeNull();
    });

    it('Returns null if getCaptchaValue is not a function', () => {
        // @ts-ignore
        window.leminCroppedCaptcha = { getCaptcha: () => ({ getCaptchaValue: 123 }) };
        const captcha = new LeminCaptcha(key, containerId);
        expect(captcha['getCaptchaValues']()).toBeNull();
    });

    it('Returns null if exception thrown', () => {
        // @ts-ignore
        window.leminCroppedCaptcha = { getCaptcha: () => { throw new Error('fail'); } };
        const captcha = new LeminCaptcha(key, containerId);
        expect(captcha['getCaptchaValues']()).toBeNull();
    });

    it('Returns value if leminCroppedCaptcha present', () => {
        window.leminCroppedCaptcha = {
            getCaptcha: () => ({
                getCaptchaValue: () => ({ challenge_id: 'id', answer: 'ans' })
            })
        };
        const captcha = new LeminCaptcha(key, containerId);

        expect(captcha['getCaptchaValues']()).toEqual({ challenge_id: 'id', answer: 'ans' });
    });

    it('Reset captcha if available', () => {
        const resetFn = vi.fn();
        // @ts-ignore
        window.leminCroppedCaptcha = { reset: resetFn };

        const captcha = new LeminCaptcha(key, containerId);
        captcha.reset();

        expect(resetFn).toHaveBeenCalled();
    });

    it('Reset disposes and re-renders if reset not available', async () => {
        // @ts-ignore
        window.leminCroppedCaptcha = {};
        const captcha = new LeminCaptcha(key, containerId);
        const disposeSpy = vi.spyOn(captcha, 'dispose');
        const renderSpy = vi.spyOn(captcha, 'render').mockResolvedValue();

        captcha.reset();
        await new Promise(r => setTimeout(r, 10));

        expect(disposeSpy).toHaveBeenCalled();
        expect(renderSpy).toHaveBeenCalled();
    });

    it('Render fails', async () => {
        // @ts-ignore
        window.leminCroppedCaptcha = {};
        const captcha = new LeminCaptcha(key, containerId);
        vi.spyOn(captcha, 'dispose').mockImplementation(() => {});
        vi.spyOn(captcha, 'render').mockRejectedValue(new Error('fail render'));
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        captcha.reset();
        await new Promise(r => setTimeout(r, 10));

        expect(consoleErrorSpy).toHaveBeenCalledWith('Ошибка сброса Lemin Captcha:', expect.any(Error));
    });

    it('Removes script and clears container', async () => {
        const captcha = new LeminCaptcha(key, containerId);
        const script = document.createElement('script');
        document.body.appendChild(script);

        // @ts-ignore
        captcha.scriptElement = script;
        captcha.dispose();

        expect(document.body.contains(script)).toBe(false);
        expect(container.innerHTML).toBe('');
        // @ts-ignore
        expect(captcha.scriptElement).toBeNull();
        // @ts-ignore
        expect(captcha.isLoaded).toBe(false);
    });

    it('Dispose ogs warning if container does not exist', () => {
        const captcha = new LeminCaptcha(key, 'no-such-id');
        // @ts-ignore
        captcha.scriptElement = null;
        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        captcha.dispose();
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Container with ID'));
    });

    it('Applies styles if elements present', () => {
        const inputBox = document.createElement('div');
        inputBox.className = 'lemin-captcha-input-box';
        const checkbox = document.createElement('div');
        checkbox.className = 'lemin-captcha-checkbox';
        const checkmark = document.createElement('div');
        checkmark.className = 'checkmark';
        const label = document.createElement('div');
        label.className = 'label';
        container.append(inputBox, checkbox, checkmark, label);

        const captcha = new LeminCaptcha(key, containerId);
        captcha['injectCaptchaStyles']();

        expect(inputBox.style.backgroundColor).not.toBe('');
        expect(inputBox.style.border).not.toBe('');
        expect(checkbox.style.fontSize).toBe('initial');
        expect(checkmark.style.filter).toBe('hue-rotate(90deg)');
        expect(label.textContent).toBe('Я Человек');
        expect(label.style.fontWeight).toBe('300');
    });

    it('Does nothing if container not found', () => {
        const captcha = new LeminCaptcha(key, 'no-such-id');
        expect(() => captcha['injectCaptchaStyles']()).not.toThrow();
    });
});