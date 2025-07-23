/**
 * Функция для навигации на главную страницу
 * @param event - MouseEvent
 */
export function navigateToHome(event: MouseEvent) {
    event.preventDefault();
    window.location.href = '/';
}