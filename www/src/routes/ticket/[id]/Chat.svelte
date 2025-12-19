<script lang="ts">
    import { createEventDispatcher, onMount, onDestroy } from 'svelte';
    import { getMessages, createMessage, subscribeMessages } from '$lib/utils/tickets/messages/api';
    import type { Message } from '$lib/utils/tickets/types';
    import { currentUser } from '$lib/utils/auth/storage/initial';
    import { UserRole } from '$lib/utils/auth/types';
    import { formatDate, formatName } from '$lib/utils/validation/validate';

    export let ticketId: number | string;
    export let userRole: UserRole;
    let messages: Message[] = [];
    let input = '';
    let unsubscribe: (() => void) | null = null;
    let userId: number | null = null;

    const dispatch = createEventDispatcher();

    $: userId = $currentUser?.id ? Number($currentUser.id) : null;

    function canShowInternal() {
        return userRole !== UserRole.Client && userRole !== UserRole.Anonymous;
    }

    async function sendMessage() {
        const text = input.trim();
        if (!text) return;
        await createMessage(ticketId, { message: text });
        input = '';
        const res = await getMessages(ticketId);
        if (res.success && Array.isArray(res.data)) messages = res.data;
    }

    onMount(() => {
        unsubscribe = subscribeMessages(ticketId, undefined, (msgs) => {
            messages = msgs;
        });
    });

    onDestroy(() => {
        if (unsubscribe) unsubscribe();
    });
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
        <input
            class="chat-input"
            bind:value={ input }
            placeholder="Введите сообщение..."
            on:keydown={ (e) => e.key === 'Enter' && sendMessage() }
        />
        <button class="chat-send-btn" on:click={ sendMessage } disabled={ !input.trim() }>
            Отправить
        </button>
    </div>
</div>

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
    }

    .chat-message.user {
        align-self: flex-start;
        background: var(--white);
    }

    .chat-message.staff {
        align-self: flex-end;
        background: var(--light-blue);
    }
    
    .chat-message.internal {
        align-self: center;
        background: var(--light-gray);
        color: var(--dark-gray);
    }

    .tail {
        position: absolute;
        width: 18px;
        height: 18px;
        bottom: -2px;
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
        gap: 8px;
    }
    
    .chat-input {
        flex: 1;
        padding: 10px 8px;
        border-radius: 8px;
        border: 1px solid var(--low);
        font-size: 15px;
    }
    
    .chat-send-btn {
        position: relative;
        top: -.5rem;
        padding: 8px 16px;
        border-radius: 6px;
        border: none;
        background: var(--blue);
        color: var(--white);
        font-weight: bold;
        cursor: pointer;
    }

    .chat-send-btn:disabled {
        background: var(--low);
        cursor: not-allowed;
    }
</style>