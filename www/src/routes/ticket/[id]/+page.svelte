<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { page } from '$app/stores';
    import { getAuthTokens } from '$lib/utils/auth/tokens/tokens';
    
    import { statusOptions, statusPriority, buildingOptions } from '$lib/utils/tickets/types';
    import { pageTitle, pageDescription } from '$lib/utils/setup/stores';
    import { formatDate } from '$lib/utils/tickets/support';
    import type { Ticket } from '$lib/utils/tickets/types';

    const ticketId: string = $page.params.id;

    let ticketData: Ticket;

    async function getById(id: string): Promise<Ticket> {
        const result = fetch(`/api/v1/tickets/${ticketId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthTokens()?.accessToken}`
            }
        })
        .then(response => {
            if (!response.ok) throw new Error('Ошибка получения заявки');
            return response.json();
        })
        .catch(error => {
            return {
                id: 0,
                title: 'Ошибка',
                description: error.message,
                author: 'system',
                author_contacts: '',
                status: 'cancelled',
                priority: 'critical',
                planned_at: null,
                assigned_to: null,
                created_at: new Date().toISOString(),
                attachments: null
            } as Ticket;
        });
        return result;
    }

    /**
     * Инициализация страницы при монтировании компонента
     */
    onMount(async () => {
        pageTitle.set(`Заявка №${ticketId} | Система управления заявками ЕИ КФУ`);
        ticketData = await getById(ticketId);
    });
    
    /**
     * Очистка ресурсов при уничтожении компонента
     */
    onDestroy(() => {
        pageTitle.set('ОИТ | Система управления заявками ЕИ КФУ');
        pageDescription.set('Система обработки заявок Отдела Информационных Технологий Елабужского института Казанского Федерального Университета. Система позволяет создавать заявки на услуги ОИТ, отслеживать их статус, получать советы для самостоятельного решения проблемы и многое другое.');
    });
</script>

<main>
    <div class="ticket-container">
        <div class="ticket-meta">
            <span class="ticket-id">Заявка №{ ticketId }</span>
            {#if ticketData}
                <h1 class="ticket-title">{ ticketData.title }</h1>
                <p class="ticket-tag">Время создания: <span>{ formatDate(ticketData.created_at) }</span></p>
                <p class="ticket-tag">Запланированное время: <span>{ formatDate(ticketData.planned_at || '') || 'Без даты' }</span></p>
                <br>
                <p class="ticket-tag">Статус: <span class="{ ticketData.status + '-status' }">{ statusOptions.find(option => option.serverValue === ticketData.status)?.label }</span></p>
                <p class="ticket-tag">Приоритет: <span class="{ ticketData.priority + '-priority' }">{ statusPriority.find(option => option.serverValue === ticketData.priority)?.label }</span></p>
                
                {#if ticketData.assigned_to}
                    <div class="executor-block">
                        <h3>Исполнитель</h3>
                        <p>{ ticketData.assigned_to }</p>
                    </div>
                {/if}
            {:else}
                <p class="ticket-tag">Загрузка...</p>
            {/if}
        </div>
        <div class="ticket-description">
            <h2>Описание</h2>
            {#if ticketData}
                <p>{ ticketData.description }</p>
            {:else}
                <p>Загрузка...</p>
            {/if}
            {#if ticketData && ticketData.attachments && ticketData.attachments.length > 0}
                <h3>Фото</h3>
                <ul>
                    {#each ticketData.attachments as attachment}
                        <li>{ attachment }</li>
                    {/each}
                </ul>
            {/if}
            <div class="author-contacts">
                {#if ticketData}
                    <p class="ticket-author">{ ticketData.author }</p>
                    <p class="contacts-tag">Телефон: <span>
                        <a href="tel:{ ticketData.author_contacts }" 
                            style="
                            outline: none; 
                            color: inherit;
                            text-decoration: none;">
                            { ticketData.author_contacts }
                        </a>
                    </span></p>
                    <!-- <p class="contacts-tag">Кабинет: <span>{ ticketData.building } { ticketData.cabinet }</span></p> -->
                {:else}
                    <p>Загрузка...</p>
                {/if}
            </div>
            <div class="ticket-actions">
                <button class="btn btn-primary">Начать</button>
                <button class="btn btn-secondary">Закрыть заявку</button>
            </div>
        </div>
    </div>
</main>

<style scoped>
    @import './page.css';
</style>
