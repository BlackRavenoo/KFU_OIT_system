import type { CaptchaResult } from '../initial';
import { Captcha } from '../initial';

export class SimpleCaptcha extends Captcha {
    constructor(key: string, containerId: string) {
        super(key, containerId);
    }

    public async render(): Promise<void> {
        const container = this.getContainer();
        if (!container) throw new Error("Контейнер для капчи не найден");
        else {
            if (!container.querySelector('#required-name')) {
                container.innerHTML += `<input 
                    type="text" 
                    placeholder="name" 
                    id="required-name" 
                    required 
                    autocomplete="off"
                    tabindex="-1"
                    style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;"
                />`;
            } else throw new Error("Элемент капчи существует");
        }
    }

    public async verify(): Promise<CaptchaResult> {
        const container = this.getContainer();
        if (container) {
            const input = container.querySelector<HTMLInputElement>('#required-name');
            if (!input) return { success: false, errorMessage: "Элемент капчи не найден" };

            input.required = false;

            let result: CaptchaResult;
            if (input.value === '')
                result = { success: true, token: Date.now().toString() };
            else
                result = { success: false, errorMessage: "Обнаружен бот" };

            input.required = true;

            return result;
        } else {
            return { success: false, errorMessage: "Контейнер для капчи не найден" };
        }
    }

    public reset(): void {
        const container = this.getContainer();
        if (container) {
            const input = container.querySelector<HTMLInputElement>('#required-name');
            if (input) input.value = '';
            else throw new Error("Элемент капчи не найден");
        } else throw new Error("Контейнер для капчи не найден");
    }

    public dispose(): void {
        const container = this.getContainer();
        if (container) container.innerHTML = '';
    }
}