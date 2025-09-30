<script lang="ts">
    import { handleConfirmationKeydown, setupKeydownListener, removeKeydownListener } from './Modal';
    import { fade } from 'svelte/transition';
    import { onMount, onDestroy } from 'svelte';

    export let title: string = 'Подтвердите действие';
    export let message: string = 'Вы уверены, что хотите продолжить?';
    export let confirmText: string = 'Подтвердить';
    export let cancelText: string = 'Отмена';
    export let onConfirm: () => void;
    export let onCancel: () => void;
    
    let modalElement: HTMLElement;
    
    /**
     * Обработчик нажатия клавиш для окна подтверждения
     */
    function keydownHandler(e: KeyboardEvent) {
        handleConfirmationKeydown(e, onConfirm, onCancel);
    }

    onMount(() => {
        modalElement?.focus();
        setupKeydownListener(keydownHandler);
    });

    onDestroy(() => {
        removeKeydownListener(keydownHandler);
    });
</script>

<div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="{ title }" transition:fade={{ duration: 180 }} bind:this={ modalElement }>
    <div class="modal-image">
        <p>{ message }</p>
        <div class="button-container">
            <button class="btn btn-danger" on:click={ onConfirm }>{ confirmText }</button>
            <button class="btn btn-secondary" on:click={ onCancel }>{ cancelText }</button>
        </div>
    </div>
</div>

<style scoped>
    .modal-backdrop {
        position: fixed;
        z-index: 1000;
        inset: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .modal-image {
        position: relative;
        max-height: 90vh;
        max-width: 90vw;
        min-width: 320px;    
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background-color: var(--white);
        border-radius: 10px;
        padding: 2em;
        box-shadow: 0 4px 32px rgba(0,0,0,0.25);
    }

    .modal-image p {
        font-size: 1.15em; 
        margin-bottom: 1.5em;
    }

    .button-container {
        display: flex;
        gap: 1em;
    }

    .btn {
        padding: 0.5rem 1.5rem;
        border-radius: 6px;
        border: none;
        font-size: 1rem;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
    }

    .btn-secondary {
        background: #64748b;
        color: #fff;
    }

    .btn-secondary:hover {
        background: #475569;
    }

    .btn-danger {
        background: #ef4444;
        color: #fff;
    }

    .btn-danger:hover {
        background: #b91c1c;
    }
</style>