<script lang="ts">
    import { handleModalKeydown } from '$lib/utils/notifications/modal';
    import { fade, scale } from 'svelte/transition';
    import { onMount, createEventDispatcher } from 'svelte';

    export let modalMessage: string = '';;

    const dispatch = createEventDispatcher();
    let modalElement: HTMLElement;

    /**
     * Запускает событие закрытия модального окна.
     */
    function closeModal() {
        dispatch('close');
    }

    /**
     * Обработчик нажатия клавиш в модальном окне.
     * Закрывает модальное окно при нажатии клавиши Escape.
     * @param {KeyboardEvent} e - Событие клавиатуры.
     */
    function modalKeydown(e: KeyboardEvent) {
        const result = handleModalKeydown(e, modalElement);
        if (!result) closeModal();
    }

    onMount(() => {
        modalElement?.focus();
    });
</script>

<div 
    class="modal-overlay modal-error" 
    on:click={ closeModal }
    transition:fade={{ duration: 200 }}
    role="presentation"
    tabindex="-1"
>
    <div 
        class="modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-content"
        on:click|stopPropagation
        on:keydown={ modalKeydown }
        in:scale={{ start: 0.8, duration: 300, delay: 100 }}
        out:scale={{ start: 0.8, duration: 200 }}
        tabindex="-1"
        bind:this={ modalElement }
    >
        <div class="modal-header">
            <h3 id="modal-title">Внимание</h3>
            <button
                type="button" 
                class="close-button" 
                on:click={ closeModal }
                aria-label="Закрыть окно"
            >
                <span aria-hidden="true">×</span>
            </button>
        </div>
        <div class="modal-content" id="modal-content">
            <div class="modal-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
                    <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24V264c0 13.3-10.7 24-24 24s-24-10.7-24-24V152c0-13.3 10.7-24 24-24zm-32 224a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/>
                </svg>
            </div>
            <p>{ modalMessage }</p>
        </div>
        <div class="modal-footer">
            <button class="modal-button primary-button" on:click={ closeModal }>Понятно</button>
        </div>
    </div>
</div>