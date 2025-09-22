import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { get } from 'svelte/store';

/**
 * Навигация к форме заявки.
 * Если находимся на главной странице — прокручиваем к форме.
 * Иначе переходим на главную и прокручиваем к форме после перехода.
 */
export function navigateToForm() {
    const scrollToForm = () => {
        const formElement = document.getElementById('form');
        if (formElement) {
            window.scrollTo({
                top: formElement.offsetTop - 100,
                behavior: 'smooth'
            });
        } else window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (get(page).url.pathname === '/')
        setTimeout(scrollToForm, 0);
    else
        goto('/').then(() => {
            setTimeout(scrollToForm, 100);
        });
}

/**
 * Функция для навигации на главную страницу
 * @param event - MouseEvent
 */
export function navigateToHome(event: MouseEvent) {
    event.preventDefault();
    window.location.href = '/';
}