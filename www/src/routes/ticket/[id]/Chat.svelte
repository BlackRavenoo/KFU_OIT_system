<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { getMessages, createMessage, deleteMessage, subscribeMessages } from '$lib/utils/tickets/messages/api';
    import type { Message } from '$lib/utils/tickets/types';
    import { currentUser } from '$lib/utils/auth/storage/initial';
    import { UserRole } from '$lib/utils/auth/types';
    import { formatDate, formatName } from '$lib/utils/validation/validate';
    import Confirmation from '$lib/components/Modal/Confirmation.svelte';

    export let ticketId: number | string;
    export let userRole: UserRole;
    let messages: Message[] = [];
    let input = '';
    let unsubscribe: (() => void) | null = null;
    let userId: number | null = null;

    let messageToDelete: Message | null = null;
    let showDeleteConfirm = false;

    let isInternal = false;

    const dispatch = createEventDispatcher();

    $: userId = $currentUser?.id ? Number($currentUser.id) : null;

    function canShowInternal() {
        return userRole !== UserRole.Client && userRole !== UserRole.Anonymous;
    }

    async function sendMessage() {
        const text = input.trim();
        if (!text) return;
        await createMessage(ticketId, { message: text, is_internal: isInternal });
        input = '';
        const res = await getMessages(ticketId);
        if (res.success && Array.isArray(res.data)) messages = res.data;
    }

    function askDelete(msg: Message) {
        messageToDelete = msg;
        showDeleteConfirm = true;
    }

    async function confirmDelete() {
        if (messageToDelete) {
            await deleteMessage(ticketId, messageToDelete.id);
            const res = await getMessages(ticketId);
            if (res.success && Array.isArray(res.data)) messages = res.data;
        }
        showDeleteConfirm = false;
        messageToDelete = null;
    }

    function cancelDelete() {
        showDeleteConfirm = false;
        messageToDelete = null;
    }

    onMount(() => {
        unsubscribe = subscribeMessages(ticketId, undefined, (msgs) => {
            messages = msgs;
        });
    });

    onDestroy(() => {
        if (unsubscribe) unsubscribe();
    });

    function handleInputKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }
</script>

<div class="chat-modal">
    <div class="chat-header">
        Чат по заявке
        <button class="chat-close-btn" aria-label="Закрыть чат" on:click={ () => dispatch('close') }>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="14" fill="transparent"/>
                <path d="M9 9L19 19M19 9L9 19" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
        </button>
    </div>
    <div class="chat-messages">
        {#each messages as msg (msg.id)}
            {#if !msg.is_internal || canShowInternal()}
                <div
                    class="chat-message
                        { msg.is_internal ? 'internal' : userId === msg.user.id ? 'user' : 'staff' }"
                    title={ msg.created_at }
                >
                    {#if userId === msg.user.id}
                        <button
                            class="delete-btn"
                            aria-label="Удалить сообщение"
                            on:click={() => askDelete(msg)}
                        >
                            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                                <path d="M6 8V14M10 8V14M14 8V14M3 6H17M8 6V4C8 3.44772 8.44772 3 9 3H11C11.5523 3 12 3.44772 12 4V6M5 6V16C5 17.1046 5.89543 18 7 18H13C14.1046 18 15 17.1046 15 16V6" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    {/if}
                    <div>{ msg.text }</div>
                    <div class="chat-meta">
                        <span class="chat-author">{ formatName(msg.user.name) }{ msg.is_internal ? ' (внутреннее)' : '' }</span>
                        <span class="chat-time">{ formatDate(msg.created_at) }</span>
                    </div>
                    <span
                        class="tail
                            { msg.is_internal
                                ? 'tail-right'
                                : userId === msg.user.id
                                    ? 'tail-left'
                                    : 'tail-right' }"
                    ></span>
                </div>
            {/if}
        {/each}
    </div>
    <div class="chat-footer">
        <div class="input-wrapper">
            <input
                class="chat-input"
                bind:value={ input }
                placeholder="Введите сообщение..."
                on:keydown={ handleInputKeydown }
                autocomplete="off"
            />
            <button
                class="chat-send-icon"
                aria-label="Отправить"
                on:click={ sendMessage }
                disabled={ !input.trim() }
                tabindex="-1"
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M3 20L21 12L3 4V10L17 12L3 14V20Z" fill="#bbb"/>
                </svg>
            </button>
        </div>
        {#if canShowInternal()}
            <label class="internal-checkbox">
                <input type="checkbox" bind:checked={ isInternal } />
                <span>Сделать внутренним сообщением</span>
            </label>
        {/if}
    </div>
</div>

{#if showDeleteConfirm && messageToDelete}
    <Confirmation
        title="Удалить сообщение"
        message="Вы действительно хотите удалить это сообщение?"
        confirmText="Удалить"
        cancelText="Отмена"
        onConfirm={ confirmDelete }
        onCancel={ cancelDelete }
    />
{/if}

<style scoped>
    .chat-modal {
        position: fixed;
        bottom: 40px;
        right: 40px;
        width: 400px;
        max-height: 70vh;
        background: var(--light-gray);
        border-radius: 12px;
        box-shadow: 0 2px 16px rgba(0,0,0,0.15);
        display: flex;
        flex-direction: column;
        z-index: 1000;
        overflow: hidden;
        user-select: none;
    }

    .chat-header {
        padding: 12px 16px;
        background: var(--blue);
        color: var(--white);
        font-weight: bold;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .chat-close-btn {
        position: relative;
        top: -.5rem;
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        margin-left: 8px;
        display: flex;
        align-items: center;
        transition: background 0.15s;
    }

    .chat-close-btn svg {
        display: block;
    }

    .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column-reverse;
        gap: 10px;
    }

    .chat-message {
        max-width: 70%;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 18px;
        word-break: break-word;
        position: relative;
        user-select: text;
        color: var(--text);
        margin-bottom: 8px;
        transition: background 0.15s;
    }

    .chat-message.user {
        align-self: flex-start;
        background: var(--white);
    }

    .chat-message.staff, .chat-message.internal {
        align-self: flex-end;
        background: var(--light-blue);
    }

    .delete-btn {
        position: absolute;
        top: 6px;
        right: 6px;
        background: transparent;
        border: none;
        padding: 2px;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.15s;
        z-index: 2;
        box-shadow: none !important;
        margin-top: 0;
    }
    .chat-message:hover .delete-btn {
        opacity: 1;
    }
    .delete-btn svg {
        pointer-events: none;
    }

    .tail {
        position: absolute;
        width: 18px;
        height: 18px;
        bottom: 0;
        z-index: 2;
    }

    .tail-left {
        left: -12px;
        background: none;
    }

    .tail-right {
        right: -12px;
        background: none;
    }

    .tail-left::after {
        content: '';
        position: absolute;
        left: 0;
        bottom: 0;
        width: 18px;
        height: 18px;
        background: transparent;
        clip-path: polygon(0 100%, 100% 0, 100% 100%);
        background: var(--white);
        box-shadow: -1px 1px 2px rgba(0,0,0,0.04);
    }

    .tail-right::after {
        content: '';
        position: absolute;
        right: 0;
        bottom: 0;
        width: 18px;
        height: 18px;
        background: transparent;
        clip-path: polygon(0 0, 100% 100%, 0 100%);
        background: var(--light-blue);
        box-shadow: 1px 1px 2px rgba(0,0,0,0.04);
    }

    .chat-meta {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        opacity: 0.7;
        margin-top: 2px;
        gap: 10px;
    }
    .chat-author {
        flex: 1 1 auto;
        text-align: left;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .chat-time {
        flex: 0 0 auto;
        text-align: right;
        margin-left: 10px;
        white-space: nowrap;
    }
    
    .chat-footer {
        padding: 12px 16px;
        background: var(--light-gray);
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .internal-checkbox {
        font-size: 14px;
        margin: -10px 0 -5px -25px;
        display: flex;
        align-items: center;
        gap: 6px;
        user-select: none;
        color: var(--text);
        transform: scale(.85);
    }

    .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        width: 100%;
    }

    .chat-input {
        flex: 1;
        padding: 10px 40px 10px 8px;
        border-radius: 8px;
        border: 1px solid var(--low);
        font-size: 15px;
        width: 100%;
        box-sizing: border-box;
    }

    .chat-send-icon {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        background: transparent;
        border: none;
        padding: 0;
        margin: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        opacity: 0.7;
        transition: opacity 0.15s;
        box-shadow: none !important;
        filter: brightness(1);
        transition: ease filter 0.15s;
    }
    .chat-send-icon:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
    .chat-send-icon:hover:enabled {
        filter: brightness(.5);
    }
    .chat-send-icon svg {
        display: block;
        pointer-events: none;
    }

    @media (max-width: 900px) {
        .chat-modal {
            left: 0 !important;
            top: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-width: 100vw !important;
            max-height: 100vh !important;
            border-radius: 0 !important;
            box-shadow: none !important;
        }
    }
</style>