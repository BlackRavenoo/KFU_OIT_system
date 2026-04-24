import type { CaptchaResult } from '../initial';
import { Captcha } from '../initial';

/**
 * Класс, реализующий простую капчу, которая проверяет, что пользователь не заполнил скрытое поле.
 * Капча рендерит скрытое текстовое поле, которое должно оставаться пустым. 
 * Если поле заполнено, капча считает, что это бот.
 */
export class SimpleCaptcha extends Captcha {
    /**
     * Создает экземпляр простой капчи
     * @param key Ключ API для капчи
     * @param containerId ID элемента, в который будет вставлена капча
     */
    constructor(key: string, containerId: string) {
        super(key, containerId);
    }

    /**
     * Рендерит капчу в контейнере.
     * @returns {Promise<void>} Promise, который разрешается после рендеринга капчи
     */
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
            } else console.warn("Элемент капчи уже существует в контейнере");
        }
    }

    /**
     * Функция проверки капчи. 
     * Считает капчу пройденной, если скрытое поле пустое. 
     * Если поле заполнено, возвращает ошибку.
     * @returns {Promise<CaptchaResult>} Promise с результатом проверки
     */
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

    /**
     * Сбрасывает капчу, очищая значение скрытого поля.
     */
    public reset(): void {
        const container = this.getContainer();
        if (container) {
            const input = container.querySelector<HTMLInputElement>('#required-name');
            if (input) input.value = '';
            else throw new Error("Элемент капчи не найден");
        } else throw new Error("Контейнер для капчи не найден");
    }

    /**
     * Удаляет капчу из контейнера, очищая его содержимое.
     */
    public dispose(): void {
        const container = this.getContainer();
        if (container) container.innerHTML = '';
        else console.warn("Контейнер для капчи не найден");
    }
}