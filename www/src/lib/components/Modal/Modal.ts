import type Modal from "./Modal.svelte";

/**
 * Показывает модальное окно с сообщением и устанавливает фокус на первое доступное поле.
 * @param {string} message - Сообщение для отображения в модальном окне.
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