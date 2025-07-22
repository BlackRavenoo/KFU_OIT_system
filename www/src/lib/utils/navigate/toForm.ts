import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { get } from 'svelte/store';

let visibleElements: Record<string, boolean> = {
    header: false,
    hero: false,
    features: false,
    form: false,
    faq: false
};

/**
 * Функция для обработки навигации к форме
 * Вызывается при клике на кнопку "Оставить заявку"
 */
export function navigateToFormLink() {
    let link = document.getElementById('form-link');
    link && link.click();
}

/**
 * Функция для навигации к форме заявки
 * Вызывается при клике на ссылку "Оставить заявку"
 * Если находимся на главной странице, прокручиваем к форме
 * Иначе переходим на главную страницу и прокручиваем к форме
 */
export function navigateToFormExternal() {
    const event = new MouseEvent('click');
    navigateToForm(event);
}

/**
 * Обработчик навигации к форме заявки
 * Предотвращает стандартное поведение ссылки и выполняет прокрутку к форме
 * Вызывается при клике на ссылку "Оставить заявку" или navigateToFormExternal
 */
export function navigateToForm(event: MouseEvent) {
    event.preventDefault();
    get(page).url.pathname === '/' ?
        scrollWithCompensation() :
        goto('/').then(() => {
            setTimeout(scrollWithCompensation, 100);
        });
}

/**
 * Прокручивает страницу к форме заявки с компенсацией высоты шапки
 * Если элемент с id "marker" существует, прокручивает к нему
 * Иначе прокручивает к элементу с id "form"
 * Устанавливает видимость всех элементов формы в true чтобы избежать проблем с отображением
 */
function scrollWithCompensation() {
    const marker = document.getElementById('marker');
    if (marker) {
        marker.scrollIntoView({ behavior: 'auto', block: 'start' });
        
        if (visibleElements)
            Object.keys(visibleElements).forEach(key => {
                visibleElements[key] = true;
            });
        
        setTimeout(() => {
            const formElement = document.getElementById('form');
            if (formElement) {
                window.scrollTo({
                    top: formElement.offsetTop - 100,
                    behavior: 'smooth'
                });
            }
        }, 300);
    } else {
        const formElement = document.getElementById('form');
        if (formElement) {
            window.scrollTo({
                top: formElement.offsetTop - 100,
                behavior: 'smooth'
            });
        }
    }
}