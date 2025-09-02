import { Captcha, type CaptchaResult } from '../initial';

export class LeminCaptcha extends Captcha {
    private scriptElement: HTMLScriptElement | null = null;
    private isLoaded: boolean = false;

    /**
     * Создает экземпляр LeminCaptcha
     * @param key Ключ API для Lemin Captcha
     * @param containerId ID элемента, в который будет вставлена капча
     */
    constructor(key: string, containerId: string) {
        super(key, containerId);
    }

    /**
     * Функция для отображения капчи
     * @returns Результат загрузки капчи
     */
    public async render(): Promise<void> {
        const container = this.getContainer();
        if (!container)
            throw new Error(`Контейнер с ID ${this.containerId} не найден`);

        container.innerHTML = '';

        return new Promise((resolve, reject) => {
            try {
                const leminScript = document.createElement('script');
                leminScript.setAttribute('src', `https://api.leminnow.com/captcha/v1/cropped/CROPPED_${ this.key }/js`);
                
                leminScript.onload = () => {
                    this.isLoaded = true;
                    resolve();
                    this.injectCaptchaStyles();
                };
                
                leminScript.onerror = (error) => {
                    reject(new Error(`Не удалось загрузить Lemin Captcha: ${error}`));
                };

                container.parentNode?.appendChild(leminScript);
                this.scriptElement = leminScript;
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Функция для проверки капчи
     * Проверяет, был ли пользователь проверен как человек
     * @returns Результат проверки капчи
     */
    public async verify(): Promise<CaptchaResult> {
        if (!this.isLoaded) {
            return {
                success: false,
                errorMessage: "Lemin Captcha не инициализирована"
            };
        }

        const captchaValues = this.getCaptchaValues();

        if (!captchaValues) {
            return {
                success: false,
                errorMessage: "Не удалось получить значения капчи"
            };
        }

        const isCaptchaValid = captchaValues.answer && captchaValues.challenge_id;

        if (isCaptchaValid) {
            const token = JSON.stringify({
                challenge_id: captchaValues.challenge_id,
                answer: captchaValues.answer
            });
            
            return {
                success: true,
                token
            };
        }

        return {
            success: false,
            errorMessage: "Пожалуйста, пройдите проверку"
        };
    }

    /**
     * Получает значения капчи из глобального объекта
     * @return Объект с challenge_id и answer или null, если не удалось получить значения
     */
    private getCaptchaValues(): { challenge_id: string; answer: string } | null {
        try {
            if (window.leminCroppedCaptcha && typeof window.leminCroppedCaptcha.getCaptcha === 'function') {
                const captcha = window.leminCroppedCaptcha.getCaptcha();
                if (captcha && typeof captcha.getCaptchaValue === 'function')
                    return captcha.getCaptchaValue();
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Сбрасывает состояние капчи
     */
    public reset(): void {
        if (window.leminCroppedCaptcha && typeof window.leminCroppedCaptcha.reset === 'function') {
            window.leminCroppedCaptcha.reset();
        } else {
            this.dispose();
            this.render().catch(error => console.error('Ошибка сброса Lemin Captcha:', error));
        }
    }

    /**
     * Удаляет капчу и освобождает ресурсы
     */
    public dispose(): void {
        this.isLoaded = false;
        
        if (this.scriptElement && this.scriptElement.parentNode)
            this.scriptElement.parentNode.removeChild(this.scriptElement);
        
        const container = this.getContainer();
        if (container)
            container.innerHTML = '';
        
        this.scriptElement = null;
    }

    /**
     * Внедряет пользовательские стили для капчи
     */
    private injectCaptchaStyles() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        
        const captchaInputBox = container.querySelector('.lemin-captcha-input-box');
        if (captchaInputBox instanceof HTMLElement) {
            captchaInputBox.style.backgroundColor = '#075cef0d';
            captchaInputBox.style.boxShadow = 'none';
            captchaInputBox.style.border = '1px solid #e0e0e0';
            captchaInputBox.style.filter = '';
        }
        
        const captchaCheckbox = container.querySelector('.lemin-captcha-checkbox');
        if (captchaCheckbox instanceof HTMLElement) {
            captchaCheckbox.style.filter = '';
            captchaCheckbox.style.fontSize = 'initial';
        }
        
        const checkmark = container.querySelector('.checkmark');
        if (checkmark instanceof HTMLElement) {
            checkmark.style.filter = 'hue-rotate(90deg)';
        }
        
        const label = container.querySelector('.label');
        if (label instanceof HTMLElement) {
            label.textContent = 'Я Человек';
            label.style.fontSize = 'initial';
            label.style.fontWeight = '300';
            label.style.filter = '';
        }
    }
}

declare global {
    interface Window {
        leminCroppedCaptcha?: {
            getCaptcha: () => {
                getCaptchaValue: () => {
                    challenge_id: string;
                    answer: string;
                }
            },
            reset?: () => void;
        };
    }
}