/**
 * Результат проверки капчи
 */
export interface CaptchaResult {
    success: boolean;
    errorMessage?: string;
    token?: string;
}

/**
 * Абстрактный класс для работы с капчей
 */
export abstract class Captcha {
    protected key: string;
    protected containerId: string;

    /**
     * Создает экземпляр капчи
     * @param key Ключ API для капчи
     * @param containerId ID элемента, в который будет вставлена капча
     */
    constructor(key: string, containerId: string) {
        this.key = key;
        this.containerId = containerId;

        if (!this.key)
            throw new Error("Не указан ключ капчи");

        if (!this.containerId)
            throw new Error("Не указан ID контейнера для капчи");
    }

    /**
     * Рендерит капчу в указанный контейнер
     * @returns Promise, который разрешается, когда капча загружена
     */
    public abstract render(): Promise<void>;

    /**
     * Проверяет валидность ответа капчи
     * @returns Promise с результатом проверки
     */
    public abstract verify(): Promise<CaptchaResult>;

    /**
     * Сбрасывает состояние капчи
     */
    public abstract reset(): void;

    /**
     * Удаляет капчу и освобождает ресурсы
     */
    public abstract dispose(): void;

    /**
     * Получает элемент контейнера для капчи
     * @returns HTML-элемент контейнера или null, если не найден
     */
    protected getContainer(): HTMLElement | null {
        return document.getElementById(this.containerId);
    }
}