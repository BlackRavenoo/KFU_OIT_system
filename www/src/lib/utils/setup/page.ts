/**
 * Интерфейс для отслеживания видимости элементов на странице
 * @interface VisibleElements
 */
export interface VisibleElements {
    [key: string]: boolean;
}

/**
 * Настройка Intersection Observer для отслеживания видимости ключевых элементов
 * Используется для анимации появления элементов при прокрутке страницы
 */
export function setupIntersectionObserver(
    elementIds: string[],
    visibleElements: VisibleElements,
    options: IntersectionObserverInit = { threshold: 0.2, rootMargin: "0px 0px -100px 0px" }
): IntersectionObserver {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                if (id && id in visibleElements)
                    visibleElements[id] = true;
            }
        });
    }, options);

    elementIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) observer.observe(element);
    });

    return observer;
}

/**
 * Функция для загрузки CSS-контента в виде тега <style>
 * @param {string} css - CSS-код для загрузки
 * @param {string} [id] - Необязательный идентификатор для тега <style>
 * @returns {HTMLElement} - Возвращает созданный элемент <style>
 */
export function loadStyleContent(css: string, styleElements: HTMLElement[], id?: string): HTMLElement {
    const style = document.createElement('style');
    style.textContent = css;
    if (id) style.id = id;
    document.head.appendChild(style);
    styleElements.push(style);
    return style;
}

/**
 * Функция для очистки всех стилей, добавленных в документ
 * Удаляет все элементы <style> из document.head
 * @param {HTMLElement[]} styleElements - Массив элементов <style> для удаления
 */
export function cleanupStyleElements(styleElements: HTMLElement[]) {
    styleElements.forEach(element => {
        element && element.parentNode && element.parentNode.removeChild(element);
    });
}