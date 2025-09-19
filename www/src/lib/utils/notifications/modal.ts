/**
 * Обработчик нажатия клавиш в модальном окне.
 * Закрывает модальное окно при нажатии Escape и управляет фокусом при Tab.
 */
export function handleModalKeydown(e: KeyboardEvent, modalElement: HTMLElement) {
    if (e.key === 'Escape') {
        return false;
    }
    if (e.key === 'Tab') {
        const focusableElements = Array.from(
            modalElement.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
        );
        if (!focusableElements.length) return true;
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
        if (e.shiftKey && document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
        } else {
            return true;
        }
    }
    return true;
}

/**
 * Переключает видимость модального окна и устанавливает фокус
 */
export function showModal(modalElement?: HTMLElement) {
    setTimeout(() => {
        if (modalElement) {
            const firstFocusable = modalElement.querySelector(
                'input, button:not(.modal-close), [tabindex]:not([tabindex="-1"])'
            ) as HTMLElement;
            firstFocusable ? firstFocusable.focus() : modalElement.focus();
        }
    }, 100);
}