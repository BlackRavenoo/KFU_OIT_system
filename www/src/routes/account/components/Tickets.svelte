<script lang="ts">
    import { onMount } from 'svelte';
    import { formatDate } from '$lib/utils/tickets/support';
    import { currentUser } from '$lib/utils/auth/storage/initial';
    import { fetchTickets } from '$lib/utils/tickets/api/get';
    import { statusOptions, statusPriority } from '$lib/utils/tickets/types';
    import { notification, NotificationType } from '$lib/utils/notifications/notification';
    import { getTicketsFilters, setTicketsFilters } from '$lib/utils/tickets/stores';
    
    let tickets: any[] = [];
    let loading = true;
    let error = false;
    
    let filters = getTicketsFilters();
    let { viewMode, sortOrder } = filters;
    
    let currentPage = 1;
    let totalPages = 1;
    const itemsPerPage = 10;
    
    onMount(async () => {
        await loadTickets();
    });
    
    async function loadTickets() {
        loading = true;
        try {
            if ($currentUser && $currentUser.id) {
                const response = await fetchTickets('', {
                    assigned_to: $currentUser.id,
                    page: currentPage,
                    page_size: itemsPerPage,
                    order_by: 'id',
                    sort_order: sortOrder
                });
                
                tickets = response.tickets;
                totalPages = response.max_page;
            }
        } catch (e) {
            console.error("Error loading tickets:", e);
            notification('Ошибка загрузки заявок', NotificationType.Error);
            error = true;
        } finally {
            loading = false;
        }
    }
    
    function changePage(page: number) {
        if (page !== currentPage && page > 0 && page <= totalPages) {
            currentPage = page;
            loadTickets();
        }
    }
    
    function handleToggleSort() {
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        setTicketsFilters({ ...filters, sortOrder });
        loadTickets();
    }
    
    function handleToggleViewMode() {
        viewMode = viewMode === 'cards' ? 'list' : 'cards';
        setTicketsFilters({ ...filters, viewMode });
    }
</script>

<div class="tickets-section">
    <h1>Мои заявки</h1>
    
    <div class="search-controls">
        <button
            type="button"
            class="sort-order-btn"
            aria-label="Сменить порядок сортировки"
            on:click={ handleToggleSort }
        >
            {#if sortOrder === 'asc'}
                <svg width="22" height="22" viewBox="0 0 24 24">
                    <path d="M12 6v12m0 0l-6-6m6 6l6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
                </svg>
            {:else}
                <svg width="22" height="22" viewBox="0 0 24 24">
                    <path d="M12 18V6m0 0l-6 6m6-6l6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
                </svg>
            {/if}
        </button>
        <button
            type="button"
            class="view-mode-btn"
            aria-label="Переключить режим отображения"
            on:click={ handleToggleViewMode }
        >
            {#if viewMode === 'cards'}
                <svg width="22" height="22" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="7" height="7" rx="2" fill="currentColor"/>
                    <rect x="14" y="3" width="7" height="7" rx="2" fill="currentColor"/>
                    <rect x="3" y="14" width="7" height="7" rx="2" fill="currentColor"/>
                    <rect x="14" y="14" width="7" height="7" rx="2" fill="currentColor"/>
                </svg>
            {:else}
                <svg width="22" height="22" viewBox="0 0 24 24">
                    <rect x="4" y="6" width="16" height="2" rx="1" fill="currentColor"/>
                    <rect x="4" y="11" width="16" height="2" rx="1" fill="currentColor"/>
                    <rect x="4" y="16" width="16" height="2" rx="1" fill="currentColor"/>
                </svg>
            {/if}
        </button>
    </div>
    
    {#if loading}
        <div class="loading-state">
            <div class="loader"></div>
            <p>Загрузка заявок...</p>
        </div>
    {:else if error}
        <div class="error-state">
            <p>Произошла ошибка при загрузке заявок. Пожалуйста, попробуйте позже.</p>
            <button class="btn" on:click={ loadTickets }>Попробовать снова</button>
        </div>
    {:else if tickets.length === 0}
        <div class="empty-state">
            <p>У вас нет активных заявок</p>
        </div>
    {:else}
        <div class="tickets-list { viewMode === 'list' ? 'list-view' : 'cards-view' }">
            {#each tickets as ticket}
                {#if viewMode === 'list'}
                    <div class="ticket-item" 
                        role="link"
                        tabindex="0"
                        aria-label={`Открыть заявку ${ticket.title}`}
                        on:click={() => window.location.href = `/ticket/${ticket.id}`}
                        on:keydown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ')
                                window.location.href = `/ticket/${ticket.id}`;
                        }}
                    >
                        <div class="ticket-title">
                            { ticket.title } 
                            <span class="{ statusPriority.find(option => option.serverValue === ticket.priority)?.value + '-status' || '' }">
                                { statusOptions.find(option => option.serverValue === ticket.status)?.label || '' }
                            </span>
                        </div>
                        <div class="ticket-meta">
                            { ticket.author ?? 'Без автора' } • { formatDate(ticket.planned_at) ?? 'Без даты' } • { ticket.building.name ?? 'Не указано' }
                        </div>
                        <div class="ticket-desc">
                            { ticket.description.length > 100
                                ? ticket.description.slice(0, 100) + '...'
                                : ticket.description }
                        </div>
                    </div>
                {:else}
                    <div class="ticket-card { statusOptions.find(option => option.serverValue === ticket.status)?.value || '' }"
                        role="link"
                        tabindex="0"
                        aria-label={`Открыть заявку ${ ticket.title }`}
                        on:click={() => window.location.href = `/ticket/${ticket.id}`}
                        on:keydown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ')
                                window.location.href = `/ticket/${ticket.id}`;
                        }}
                    >
                        <div class="ticket-title">{ ticket.title }</div>
                        <div class="ticket-meta">
                            { ticket.author ?? 'Без автора' } • { formatDate(ticket.planned_at) ?? 'Без даты' } • { ticket.building.name ?? 'Не указано' }
                        </div>
                        <div class="ticket-desc">
                            { ticket.description.length > 100
                                ? ticket.description.slice(0, 100) + '...'
                                : ticket.description }
                        </div>
                        <div class="status { statusPriority.find(option => option.serverValue === ticket.priority)?.value + '-status' || '' }"></div>
                    </div>
                {/if}
            {/each}
        </div>
        
        {#if totalPages > 1}
            <div class="pagination-block">
                {#if currentPage > 1}
                    <button aria-label="Назад" class="pagination-button" on:click={() => changePage(currentPage - 1)}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M416 160C416 147.1 408.2 135.4 396.2 130.4C384.2 125.4 370.5 128.2 361.3 137.3L201.3 297.3C188.8 309.8 188.8 330.1 201.3 342.6L361.3 502.6C370.5 511.8 384.2 514.5 396.2 509.5C408.2 504.5 416 492.9 416 480L416 160z"/></svg>
                    </button>
                {/if}
                <span>Стр. { currentPage } из { totalPages }</span>
                {#if totalPages > 1 && currentPage < totalPages}
                    <button aria-label="Вперёд" class="pagination-button" on:click={() => changePage(currentPage + 1)}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M224.5 160C224.5 147.1 232.3 135.4 244.3 130.4C256.3 125.4 270 128.2 279.1 137.4L439.1 297.4C451.6 309.9 451.6 330.2 439.1 342.7L279.1 502.7C269.9 511.9 256.2 514.6 244.2 509.6C232.2 504.6 224.5 492.9 224.5 480L224.5 160z"/></svg>
                    </button>
                {/if}
            </div>
        {/if}
    {/if}
</div>

<style>
    @import './Tickets.css';
</style>