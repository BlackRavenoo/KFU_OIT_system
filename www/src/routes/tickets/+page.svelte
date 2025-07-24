<script lang="ts">
    import { onMount } from 'svelte';

    import { TICKETS_API_ENDPOINTS } from '$lib/utils/tickets/api/endpoints';

    let tickets: any[] = [];
    let error: string | null = null;

    onMount(async () => {
        try {
            const res = await fetch(TICKETS_API_ENDPOINTS.read, { credentials: 'include' });
            if (!res.ok) throw new Error('Ошибка загрузки тикетов');
            tickets = await res.json();
        } catch (e) {
            if (e instanceof Error)
                error = e.message || 'Ошибка';
        }
    });
</script>

{#if error}
    <div>Ошибка: { error }</div>
{:else if tickets.length === 0}
    <div>Нет тикетов</div>
{:else}
    <ul>
        {#each tickets as ticket}
            <li>
                <div><b>{ ticket.title }</b></div>
                <div>{ ticket.description }</div>
                <div>Автор: { ticket.author }</div>
                <div>Контакт: { ticket.author_contacts }</div>
                <div>Дата: { ticket.planned_at }</div>
            </li>
        {/each}
    </ul>
{/if}