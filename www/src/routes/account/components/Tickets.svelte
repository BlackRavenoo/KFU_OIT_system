<script lang="ts">
    import { onMount } from 'svelte';
    import { formatDate, formatName, formatTitle, formatDescription } from '$lib/utils/validation/validate';
    import { currentUser } from '$lib/utils/auth/storage/initial';
    import { fetchTickets } from '$lib/utils/tickets/api/get';
    import { statusOptions, statusPriority } from '$lib/utils/tickets/types';
    import { getTicketsFilters, setTicketsFilters } from '$lib/utils/tickets/stores';
    import { updateTicket } from '$lib/utils/tickets/api/set';
    import { UserRole } from '$lib/utils/auth/types';
    import Pagination from '$lib/components/Search/Pagination.svelte';
    import Confirmation from '$lib/components/Modal/Confirmation.svelte';

    let tickets: any[] = [];
    let loading = true;
    let error = false;

    let filters = getTicketsFilters();
    let { viewMode, sortOrder, page_size } = filters;

    type SimpleStatus = 'inprogress' | 'closed' | 'cancelled';
    let selectedStatuses: SimpleStatus[] = ['inprogress', 'closed', 'cancelled'];

    let currentPage = 1;
    let totalPages = 1;

    function resolveCriticalServerValue(): string {
        const val = statusPriority.find(o => (o as any).value === 'critical')?.serverValue;
        return String(val ?? 'critical');
    }

    function isCritical(ticket: any): boolean {
        const v = String(ticket?.priority ?? '').toLowerCase();
        const critical = resolveCriticalServerValue().toLowerCase();
        return v === critical || v === 'critical';
    }

    let confirmVisible = false;
    let ticketForCritical: any = null;

    function promptCritical(ticket: any) {
        if (isCritical(ticket)) return;
        ticketForCritical = ticket;
        confirmVisible = true;
    }

    async function confirmSetCritical() {
        const id = ticketForCritical?.id != null ? String(ticketForCritical.id) : '';
        if (!id) {
            confirmVisible = false;
            ticketForCritical = null;
            return;
        }
        try {
            const newPriority = resolveCriticalServerValue();
            await updateTicket(id, { priority: newPriority });
            tickets = tickets.map(t => t.id === ticketForCritical.id ? { ...t, priority: newPriority } : t);
        } finally {
            confirmVisible = false;
            ticketForCritical = null;
        }
    }
    function cancelSetCritical() {
        confirmVisible = false;
        ticketForCritical = null;
    }

    async function loadTickets() {
        loading = true;
        error = false;
        try {
            if ($currentUser && $currentUser.id) {
                const statuses = selectedStatuses.length > 0
                    ? selectedStatuses
                    : (['inprogress', 'closed', 'cancelled'] as SimpleStatus[]);

                const response = await fetchTickets('', {
                    assigned_to: $currentUser.id,
                    page: currentPage,
                    page_size,
                    order_by: 0,
                    sort_order: sortOrder,
                    statuses
                });

                tickets = response.tickets;
                totalPages = response.max_page;
            } else {
                tickets = [];
                totalPages = 1;
            }
        } catch (e) {
            console.error('Error loading tickets:', e);
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
        const f = getTicketsFilters();
        sortOrder = f.sortOrder === 'asc' ? 'desc' : 'asc';
        setTicketsFilters({ ...f, sortOrder });
        currentPage = 1;
        loadTickets();
    }

    function handleToggleViewMode() {
        const f = getTicketsFilters();
        viewMode = f.viewMode === 'cards' ? 'list' : 'cards';
        setTicketsFilters({ ...f, viewMode });
    }

    function handlePageSizeChange() {
        let n = Number(page_size);
        if (!Number.isFinite(n)) n = 10;
        n = Math.max(10, Math.min(50, Math.trunc(n)));
        page_size = n;
        const f = getTicketsFilters();
        setTicketsFilters({ ...f, page_size });
        currentPage = 1;
        loadTickets();
    }

    function toggleStatusFilter(s: SimpleStatus) {
        selectedStatuses = selectedStatuses.includes(s)
            ? selectedStatuses.filter(x => x !== s)
            : [...selectedStatuses, s];
        currentPage = 1;
        loadTickets();
    }

    onMount(async () => {
        const f = getTicketsFilters();
        page_size = Number(f.page_size ?? 10);
        if (!Number.isFinite(page_size) || page_size <= 0) {
            page_size = 10;
            setTicketsFilters({ ...f, page_size });
        }
        await loadTickets();
    });
</script>

<div class="tickets-section">
    <h1>Мои заявки</h1>

    <div class="toolbar">
        <div class="controls">
            <input
                type="number"
                class="page-size-input"
                min="10"
                max="50"
                bind:value={ page_size }
                placeholder="Кол-во на странице"
                on:change={ handlePageSizeChange }
            />
            <button
                type="button"
                class="sort-order-btn"
                aria-label="Сменить порядок сортировки"
                on:click={ handleToggleSort }
                title="Сменить порядок сортировки"
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
                title="Переключить режим отображения"
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
    </div>

    {#if $currentUser?.role !== UserRole.Client}
        <div class="status-filters" role="group" aria-label="Фильтр по статусу">
            <button
                type="button"
                class="status-chip inprogress { selectedStatuses.includes('inprogress') ? 'active' : '' }"
                on:click={ () => toggleStatusFilter('inprogress') }
                aria-pressed={ selectedStatuses.includes('inprogress') }
            >
                В процессе
            </button>
            <button
                type="button"
                class="status-chip closed { selectedStatuses.includes('closed') ? 'active' : '' }"
                on:click={ () => toggleStatusFilter('closed') }
                aria-pressed={ selectedStatuses.includes('closed') }
            >
                Выполненные
            </button>
            <button
                type="button"
                class="status-chip cancelled { selectedStatuses.includes('cancelled') ? 'active' : '' }"
                on:click={ () => toggleStatusFilter('cancelled') }
                aria-pressed={ selectedStatuses.includes('cancelled') }
            >
                Отклоненные
            </button>
        </div>
    {/if}

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
            <p>Заявок не найдено</p>
        </div>
    {:else}
        <div class="tickets-list { viewMode === 'list' ? 'list-view' : 'cards-view' }">
            {#each tickets as ticket}
                {#if viewMode === 'list'}
                    <div class="ticket-item" 
                        role="link"
                        tabindex="0"
                        aria-label={`Открыть заявку ${formatTitle(ticket.title)}`}
                        on:click={() => window.location.href = `/ticket/${ticket.id}`}
                        on:keydown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ')
                                window.location.href = `/ticket/${ticket.id}`;
                        }}
                    >
                        <span class="ticket-id">{ ticket.building.code }-{ ticket.id }</span>
                        <button
                            type="button"
                            class="priority-flame { isCritical(ticket) ? 'critical' : 'inactive' }"
                            aria-label={ isCritical(ticket) ? 'Критичный приоритет' : 'Сделать критичным' }
                            title={ isCritical(ticket) ? 'Критичный приоритет' : 'Сделать критичным' }
                            on:click|stopPropagation={ () => promptCritical(ticket) }
                            disabled={ isCritical(ticket) }
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                {#if isCritical(ticket)}
                                    <defs>
                                        <radialGradient id={"flame-grad-" + ticket.id} cx="50%" cy="55%" r="60%">
                                            <stop offset="0%" stop-color="#fde047" />
                                            <stop offset="35%" stop-color="#fbbf24" />
                                            <stop offset="100%" stop-color="#f97316" />
                                        </radialGradient>
                                    </defs>
                                    <path d="M12 2c1.4 2 1 3.6 1 3.6s2.1-1 3.6 1.4c1.2 1.8.5 4.1-.5 5.4A6.5 6.5 0 1 1 6 14c0-2 1.1-3.6 2.6-4.6 0 0-.6 2 1.4 3.1 0 0 .1-3 2-5.5z"
                                        fill={"url(#flame-grad-" + ticket.id + ")"} />
                                {:else}
                                    <path d="M12 2c1.4 2 1 3.6 1 3.6s2.1-1 3.6 1.4c1.2 1.8.5 4.1-.5 5.4A6.5 6.5 0 1 1 6 14c0-2 1.1-3.6 2.6-4.6 0 0-.6 2 1.4 3.1 0 0 .1-3 2-5.5z"
                                        fill="currentColor" />
                                {/if}
                            </svg>
                        </button>

                        <div
                            class="priority-chip priority-chip-list { String(ticket?.priority ?? '').toLowerCase() }"
                            aria-label={`Приоритет: ${
                                String(ticket?.priority ?? '').toLowerCase() === 'low' ? 'Низкий' :
                                String(ticket?.priority ?? '').toLowerCase() === 'medium' ? 'Средний' :
                                String(ticket?.priority ?? '').toLowerCase() === 'high' ? 'Высокий' :
                                String(ticket?.priority ?? '').toLowerCase() === 'critical' ? 'Критичный' : ''
                            }`}
                        >
                            {#if String(ticket?.priority ?? '').toLowerCase() === 'low'}
                                Низкий
                            {:else if String(ticket?.priority ?? '').toLowerCase() === 'medium'}
                                Средний
                            {:else if String(ticket?.priority ?? '').toLowerCase() === 'high'}
                                Высокий
                            {:else if String(ticket?.priority ?? '').toLowerCase() === 'critical'}
                                Критичный
                            {/if}
                        </div>

                        <div class="ticket-title">
                            { formatTitle(ticket.title) }
                            <span class="{ statusOptions.find(option => option.serverValue === ticket.priority)?.value + '-status' || '' }">
                                { statusOptions.find(option => option.serverValue === ticket.status)?.label || '' }
                            </span>
                        </div>
                        <div class="ticket-meta">
                            { formatName(ticket.author) ?? 'Без автора' } • { formatDate(ticket.planned_at) ?? 'Без даты' } • { ticket.building?.name ?? 'Не указано' }
                        </div>
                        <div class="ticket-desc">
                            { formatDescription(ticket.description) }
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
                        <span class="ticket-id">{ ticket.building.code }-{ ticket.id }</span>
                        {#if $currentUser?.role !== UserRole.Client}
                            <button
                                type="button"
                                class="priority-flame { isCritical(ticket) ? 'critical' : 'inactive' }"
                                aria-label={ isCritical(ticket) ? 'Критичный приоритет' : 'Сделать критичным' }
                                title={ isCritical(ticket) ? 'Критичный приоритет' : 'Сделать критичным' }
                                on:click|stopPropagation={() => promptCritical(ticket)}
                                disabled={ isCritical(ticket) }
                            >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    {#if isCritical(ticket)}
                                        <defs>
                                            <radialGradient id={"flame-grad-" + ticket.id} cx="50%" cy="55%" r="60%">
                                                <stop offset="0%" stop-color="#fde047" />
                                                <stop offset="35%" stop-color="#fbbf24" />
                                                <stop offset="100%" stop-color="#f97316" />
                                            </radialGradient>
                                        </defs>
                                        <path d="M12 2c1.4 2 1 3.6 1 3.6s2.1-1 3.6 1.4c1.2 1.8.5 4.1-.5 5.4A6.5 6.5 0 1 1 6 14c0-2 1.1-3.6 2.6-4.6 0 0-.6 2 1.4 3.1 0 0 .1-3 2-5.5z"
                                            fill={"url(#flame-grad-" + ticket.id + ")"} />
                                    {:else}
                                        <path d="M12 2c1.4 2 1 3.6 1 3.6s2.1-1 3.6 1.4c1.2 1.8.5 4.1-.5 5.4A6.5 6.5 0 1 1 6 14c0-2 1.1-3.6 2.6-4.6 0 0-.6 2 1.4 3.1 0 0 .1-3 2-5.5z"
                                            fill="currentColor" />
                                    {/if}
                                </svg>
                            </button>
                        {/if}

                        <div
                            class="priority-chip { String(ticket?.priority ?? '').toLowerCase() }"
                            aria-label={`Приоритет: ${
                                String(ticket?.priority ?? '').toLowerCase() === 'low' ? 'Низкий' :
                                String(ticket?.priority ?? '').toLowerCase() === 'medium' ? 'Средний' :
                                String(ticket?.priority ?? '').toLowerCase() === 'high' ? 'Высокий' :
                                String(ticket?.priority ?? '').toLowerCase() === 'critical' ? 'Критичный' : ''
                            }`}
                        >
                            {#if String(ticket?.priority ?? '').toLowerCase() === 'low'}
                                Низкий
                            {:else if String(ticket?.priority ?? '').toLowerCase() === 'medium'}
                                Средний
                            {:else if String(ticket?.priority ?? '').toLowerCase() === 'high'}
                                Высокий
                            {:else if String(ticket?.priority ?? '').toLowerCase() === 'critical'}
                                Критичный
                            {/if}
                        </div>

                        <div class="ticket-title">{ formatTitle(ticket.title) }</div>
                        <div class="ticket-meta">
                            { formatName(ticket.author) ?? 'Без автора' } • { formatDate(ticket.planned_at) ?? 'Без даты' } • { ticket.building?.name ?? 'Не указано' }
                        </div>
                        <div class="ticket-desc">
                            { formatDescription(ticket.description) }
                        </div>
                    </div>
                {/if}
            {/each}
        </div>

        <Pagination 
            { currentPage }
            { totalPages }
            onPageChange={ changePage }
        />
    {/if}

    {#if confirmVisible}
        <Confirmation
            title="Критичный приоритет"
            message={`Установить критичный приоритет для заявки #${ticketForCritical?.id}?`}
            confirmText="Сделать критичной"
            cancelText="Отмена"
            onConfirm={ confirmSetCritical }
            onCancel={ cancelSetCritical }
        />
    {/if}
</div>

<style>
    @import '../../ticket/page.css';
    @import './Tickets.css';
</style>