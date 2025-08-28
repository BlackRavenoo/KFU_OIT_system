import type Modal from "./Modal.svelte";

/**
 * Показывает модальное окно с сообщением и устанавливает фокус на первое доступное поле.
 * @param setShowModal - Функция для управления видимостью модального окна.
 * @param message - Сообщение для отображения в модальном окне.
 */
export function showModalWithFocus(
    setShowModal: (val: boolean) => void,
    modalElementRef: Modal | undefined
) {
    setShowModal(true);
    setTimeout(() => {
        const modalElement = modalElementRef;
        const focusable = modalElement?.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable?.length) (focusable[0] as HTMLElement).focus();
    }, 100);
}

/**
 * Обрабатывает нажатия клавиш в модальном окне
 * @param event Событие нажатия клавиши
 * @param closeCallback Функция для закрытия окна
 * @returns true если нажатие клавиши было обработано
 */
export function handleModalKeydown(event: KeyboardEvent, closeCallback: () => void): boolean {
    if (event.key === 'Escape' || event.key === 'Enter') {
        closeCallback();
        return true;
    }
    return false;
}

/**
 * Обрабатывает нажатия клавиш в окне подтверждения
 * @param event Событие нажатия клавиши
 * @param confirmCallback Функция для подтверждения
 * @param cancelCallback Функция для отмены
 * @returns true если нажатие клавиши было обработано
 */
export function handleConfirmationKeydown(
    event: KeyboardEvent, 
    confirmCallback: () => void, 
    cancelCallback: () => void
): boolean {
    if (event.key === 'Escape') {
        cancelCallback();
        return true;
    } else if (event.key === 'Enter') {
        confirmCallback();
        return true;
    }
    return false;
}

/**
 * Добавляет обработчик клавиатуры при монтировании компонента
 * @param handler Функция обработки нажатия клавиш
 */
export function setupKeydownListener(handler: (event: KeyboardEvent) => void): void {
    window.addEventListener('keydown', handler);
}

/**
 * Удаляет обработчик клавиатуры при уничтожении компонента
 * @param handler Функция обработки нажатия клавиш
 */
export function removeKeydownListener(handler: (event: KeyboardEvent) => void): void {
    window.removeEventListener('keydown', handler);
}