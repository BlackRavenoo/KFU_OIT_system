import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { get } from 'svelte/store';

/**
 * !!! TDD !!!
 * Сократить количество функций навигации к форме
 * Исправить проблему отсутствия срабатывания после входа в аккаунт 
 */


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
 * Устанавливает видимость всех элементов формы в true чтобы избежать проблем с отображением
 */
function scrollWithCompensation() {
    const formElement = document.getElementById('form');
    if (formElement) {
        window.scrollTo({
            top: formElement.offsetTop - 100,
            behavior: 'smooth'
        });
    }
}