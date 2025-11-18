<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { page as pageStore } from '$app/stores';
    import { get } from 'svelte/store';
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import { fade, slide } from 'svelte/transition';

    import { formatDate, formatName, formatTitle, formatDescription } from '$lib/utils/validation/validate';
    import { isAuthenticated, currentUser } from '$lib/utils/auth/storage/initial';
    import { pageTitle, pageDescription, buildings } from '$lib/utils/setup/stores';
    import { fetchTickets, fetchConsts } from '$lib/utils/tickets/api/get';
    import { statusOptions, statusPriority } from '$lib/utils/tickets/types';
    import { getTicketsFilters, setTicketsFilters, clearTicketsFilters } from '$lib/utils/tickets/stores';
    import { updateTicket } from '$lib/utils/tickets/api/set';
    import { handleAuthError } from '$lib/utils/api';
    import { UserRole } from '$lib/utils/auth/types';

    import SearchBar from '$lib/components/Search/Searchfield.svelte';
    import Pagination from '$lib/components/Search/Pagination.svelte';
    import Confirmation from '$lib/components/Modal/Confirmation.svelte';

    let tickets: any[] = [];
    let error: string | null = null;
    let sortConsts = [{ id: 0, name: 'Загрузка...' }];

    let filters = getTicketsFilters();
    let page = 1;
    let maxPage = 1;

    let filtersCollapsed = true;
    let isMobile = false;

    let { search, viewMode, sortOrder, selectedStatus, selectedBuildings, plannedFrom, plannedTo, page_size, selectedSort } = filters;

    if (!Array.isArray(selectedStatus))
        selectedStatus = selectedStatus && selectedStatus !== 'all' ? [String(selectedStatus)] : [];

    $: setTicketsFilters({ search, viewMode, sortOrder, selectedStatus, selectedBuildings, plannedFrom, plannedTo, page_size, selectedSort, page });

    $: {
        const $page = get(pageStore);
        if ($page.url.searchParams) {
            const pageParam = $page.url.searchParams.get('page');
            if (pageParam && !isNaN(Number(pageParam))) {
                const pageNumber = Number(pageParam);
                if (pageNumber > 0)
                    page = pageNumber;
            }
        }
    }

    function updatePageUrl() {
        if (browser) {
            const url = new URL(window.location.href);
            page > 1 ?
                url.searchParams.set('page', page.toString()) :
                url.searchParams.delete('page');
            goto(url.toString(), { replaceState: true, keepFocus: true });
        }
    }

    async function handlePageChange(newPage: number) {
        page = newPage;
        updatePageUrl();
        const result = await fetchTickets(search, { page });
        tickets = result.tickets;
        maxPage = result.max_page;
    }

    async function handleSearch() {
        page = 1;
        updatePageUrl();
        const result = await fetchTickets(search, { page });
        tickets = result.tickets;
        maxPage = result.max_page;
    }

    function lockScroll() {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
    }
    function unlockScroll() {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
    }

    async function handleFilterChange() {
        page = 1;
        updatePageUrl();
        const result = await fetchTickets(search, { page });
        tickets = result.tickets;
        maxPage = result.max_page;
        if (isMobile) {
            filtersCollapsed = true;
            unlockScroll();
        }
    }

    async function handleToggleSort() {
        const filtersNow = getTicketsFilters();
        const newOrder = filtersNow.sortOrder === 'asc' ? 'desc' : 'asc';
        sortOrder = newOrder;
        setTicketsFilters({ ...filtersNow, sortOrder: newOrder });
        combinedSort = `${selectedSort}|${sortOrder}`;
        page = 1;
        updatePageUrl();
        const result = await fetchTickets(search, { page });
        tickets = result.tickets;
        maxPage = result.max_page;
    }

    async function handleClearFilters() {
        clearTicketsFilters();
        ({
            search,
            viewMode,
            sortOrder,
            selectedStatus,
            selectedBuildings,
            plannedFrom,
            plannedTo,
            page_size,
            selectedSort
        } = getTicketsFilters());

        if (!Array.isArray(selectedStatus))
            selectedStatus = selectedStatus && selectedStatus !== 'all' ? [String(selectedStatus)] : [];

        combinedSort = `${selectedSort}|${sortOrder}`;
        page = 1;
        updatePageUrl();
        const result = await fetchTickets(search, { page });
        tickets = result.tickets;
        maxPage = result.max_page;
    }

    function checkMobile() {
        isMobile = window.innerWidth <= 900;
        if (!isMobile) {
            filtersCollapsed = true;
            unlockScroll();
        }
    }

    function toggleFiltersCollapsed() {
        filtersCollapsed = !filtersCollapsed;
        if (isMobile) {
            if (!filtersCollapsed) lockScroll();
            else unlockScroll();
        }
    }

    let refreshTimer: ReturnType<typeof setInterval> | null = null;
    const TEN_MIN = 10 * 60 * 1000;

    async function refreshTickets() {
        try {
            const result = await fetchTickets(search, { page });
            tickets = result.tickets;
            maxPage = result.max_page;
        } catch { }
    }

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
        } catch (e) {
            console.error(e);
        } finally {
            confirmVisible = false;
            ticketForCritical = null;
        }
    }

    function cancelSetCritical() {
        confirmVisible = false;
        ticketForCritical = null;
    }

    let combinedSort = `${selectedSort}|${sortOrder}`;

    function handleCombinedSortChange(e: Event) {
        const val = (e.target as HTMLSelectElement).value;
        const [idStr, order] = val.split('|');
        selectedSort = Number(idStr);
        sortOrder = order === 'desc' ? 'desc' : 'asc';
        combinedSort = `${selectedSort}|${sortOrder}`;
        const current = getTicketsFilters();
        setTicketsFilters({ ...current, selectedSort, sortOrder });
    }

    onMount(async () => {
        pageTitle.set('Заявки | Система управления заявками ЕИ КФУ');
        pageDescription.set('Отслеживайте статус заявок, принимайте к выполнению новые. Настройте рабочее пространство под себя с множеством гибких фильтров и сортировок.');
        
        if (!$isAuthenticated || $currentUser === null || $currentUser.role === UserRole.Client)
            handleAuthError(get(pageStore).url.pathname);
        else {
            checkMobile();
            window.addEventListener('resize', checkMobile);
    
            try {
                const consts = await fetchConsts();
                sortConsts = consts.order;

                const result = await fetchTickets(search, { page });
                tickets = result.tickets;
                maxPage = result.max_page;
    
                if (page > maxPage && maxPage > 0) {
                    page = 1;
                    updatePageUrl();
                    const updatedResult = await fetchTickets(search, { page: 1 });
                    tickets = updatedResult.tickets;
                    maxPage = updatedResult.max_page;
                }
            } catch (e) {
                error = e instanceof Error ? e.message : String(e);
            }
    
            refreshTimer = setInterval(() => { void refreshTickets(); }, TEN_MIN);
        }
    });

    onDestroy(() => {
        window.removeEventListener('resize', checkMobile);
        if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
        unlockScroll();
        pageTitle.set('Service Desk | Система управления заявками ЕИ КФУ');
        pageDescription.set('Система обработки заявок Елабужского института Казанского Федерального Университета. Система позволяет создавать заявки на услуги ОИТ, отслеживать их статус, получать советы для самостоятельного решения проблемы и многое другое.');
    });
</script>

<div id="content-panel">
    {#if isMobile}
        <button type="button" class="filters-toggle-row" on:click={ toggleFiltersCollapsed } aria-label="Показать/скрыть фильтры">
            <span>Фильтры</span>
            <svg class="arrow" width="24" height="24" viewBox="0 0 24 24">
                <path d={ filtersCollapsed ? "M6 9l6 6 6-6" : "M6 15l6-6 6 6" } stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
            </svg>
        </button>
    {/if}

    {#if !isMobile}
        <aside in:slide={{ duration: 250 }} out:fade={{ duration: 200 }}>
            <button id="clear_filters" on:click={ handleClearFilters }>Сбросить</button>
            <div class="filter">
                <span class="filter_name">Статус</span>
                <div class="filter_case">
                    {#each statusOptions.filter(s => s.value !== 'all') as status}
                        <input
                            type="checkbox"
                            name="filter-status"
                            value={ status.value }
                            id={ status.value + '-tickets' }
                            bind:group={ selectedStatus }
                        />
                        <label for={ status.value + '-tickets' }>{ status.label }</label>
                    {/each}
                </div>
            </div>
            <div class="filter">
                <span class="filter_name">Сроки</span>
                <div class="filter_case filter_case-planned">
                    <label for="planned-from">От</label>
                    <input type="date" id="planned-from" bind:value={ plannedFrom } />
                    <label for="planned-to">До</label>
                    <input type="date" id="planned-to" bind:value={ plannedTo } />
                </div>
            </div>
            <div class="filter">
                <span class="filter_name">Здание</span>
                <div class="filter_case">
                    {#each $buildings as building}
                        <input
                            type="checkbox"
                            name="filter-building"
                            value={ building.id.toString() }
                            id={ building.id.toString() }
                            checked={ selectedBuildings.includes(building.id.toString()) }
                            on:change={() => {
                                const idStr = building.id.toString();
                                if (selectedBuildings.includes(idStr))
                                    selectedBuildings = selectedBuildings.filter(b => b !== idStr);
                                else
                                    selectedBuildings = [...selectedBuildings, idStr];
                            }}
                        />
                        <label for={ building.id.toString() }>{ building.name }</label>
                    {/each}
                </div>
            </div>
            <div class="filter">
                <span class="filter_name">Сортировка</span>
                <div class="filter_case">
                    <select id="sort-select" bind:value={ combinedSort } on:change={ handleCombinedSortChange }>
                        {#each sortConsts as sort}
                            <option value={`${ sort.id }|asc`}>{ sort.name } ▲</option>
                            <option value={`${ sort.id }|desc`}>{ sort.name } ▼</option>
                        {/each}
                    </select>
                </div>
            </div>
            <button class="filter_access" on:click={ handleFilterChange }>Применить</button>
        </aside>
    {:else}
        <div class="filters-mobile-overlay {filtersCollapsed ? '' : 'open'}" transition:fade>
            {#if !filtersCollapsed}
                <aside class="mobile-full" in:slide={{ duration: 250 }} out:slide={{ duration: 180 }}>
                    <button type="button" class="filters-mobile-close" on:click={ toggleFiltersCollapsed } aria-label="Свернуть фильтры">
                        Фильтры
                        <svg width="24" height="24" viewBox="0 0 24 24">
                            <path d="M6 15l6-6 6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
                        </svg>
                    </button>

                    <button id="clear_filters" on:click={ handleClearFilters }>Сбросить</button>

                    <div class="filter">
                        <span class="filter_name">Статус</span>
                        <div class="filter_case">
                            {#each statusOptions.filter(s => s.value !== 'all') as status}
                                <input
                                    type="checkbox"
                                    name="filter-status-m"
                                    value={ status.value }
                                    id={ status.value + '-tickets-mobile' }
                                    bind:group={ selectedStatus }
                                />
                                <label for={ status.value + '-tickets-mobile' }>{ status.label }</label>
                            {/each}
                        </div>
                    </div>

                    <div class="filter">
                        <span class="filter_name">Сроки</span>
                        <div class="filter_case filter_case-planned">
                            <label for="planned-from-m">От</label>
                            <input type="date" id="planned-from-m" bind:value={ plannedFrom } />
                            <label for="planned-to-m">До</label>
                            <input type="date" id="planned-to-m" bind:value={ plannedTo } />
                        </div>
                    </div>

                    <div class="filter">
                        <span class="filter_name">Здание</span>
                        <div class="filter_case">
                            {#each $buildings as building}
                                <input
                                    type="checkbox"
                                    name="filter-building-m"
                                    value={ building.id.toString() }
                                    id={ 'm-' + building.id.toString() }
                                    checked={ selectedBuildings.includes(building.id.toString()) }
                                    on:change={() => {
                                        const idStr = building.id.toString();
                                        if (selectedBuildings.includes(idStr))
                                            selectedBuildings = selectedBuildings.filter(b => b !== idStr);
                                        else
                                            selectedBuildings = [...selectedBuildings, idStr];
                                    }}
                                />
                                <label for={ 'm-' + building.id.toString() }>{ building.name }</label>
                            {/each}
                        </div>
                    </div>

                    <div class="filter">
                        <span class="filter_name">Сортировка</span>
                        <div class="filter_case">
                            <select id="sort-select-m" bind:value={ combinedSort } on:change={ handleCombinedSortChange }>
                                {#each sortConsts as sort}
                                    <option value={`${ sort.id }|asc`}>{ sort.name } ▲</option>
                                    <option value={`${ sort.id }|desc`}>{ sort.name } ▼</option>
                                {/each}
                            </select>
                        </div>
                    </div>

                    <button class="filters-mobile-apply" on:click={ handleFilterChange } aria-label="Применить фильтры">
                        Применить
                    </button>
                </aside>
            {/if}
        </div>
    {/if}

    <main>
        <div class="search-controls-wrapper">
            <SearchBar 
                bind:searchQuery={ search }
                placeholder="Поиск по заявкам..."
                onSearch={ handleSearch }
            />
            <div class="search-controls">
                <input type="number" bind:value={ page_size } placeholder="Количество тикетов" min="10" max="50" class="page-size-input">
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
                    on:click={ () => viewMode = viewMode === 'cards' ? 'list' : 'cards' }
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

        <div class="tickets-list { viewMode === 'list' ? 'list-view' : 'cards-view' }">
            {#if error}
                <div>{ error }</div>
            {:else if tickets.length === 0}
                <div>Нет тикетов</div>
            {:else}
                {#each tickets as ticket}
                    {#if viewMode === 'list'}
                        <div class="ticket-item" 
                            role="link"
                            tabindex="0"
                            aria-label={`Открыть заявку ${formatTitle(ticket.title)}`}
                            on:click={() => window.location.href = `/ticket/${ ticket.id }`}
                            on:keydown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ')
                                    window.location.href = `/ticket/${ ticket.id }`;
                            }}
                        >
                            <span class="ticket-id">{ ticket.building.code }-{ ticket.id }</span>
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

                            <div class="priority-chip priority-chip-list { String(ticket?.priority ?? '').toLowerCase() }">
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
                                <span class="{ statusOptions.find(option => option.serverValue === ticket.status)?.value + '-status' || '' }">
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
                            on:click={() => window.location.href = `/ticket/${ ticket.id }`}
                            on:keydown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ')
                                    window.location.href = `/ticket/${ ticket.id }`;
                            }}
                        >
                            <span class="ticket-id">{ ticket.building.code }-{ ticket.id }</span>
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

                            <div class="priority-chip { String(ticket?.priority ?? '').toLowerCase() }">
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
            {/if}
        </div>

        <Pagination 
            currentPage={ page }
            totalPages={ maxPage }
            onPageChange={ handlePageChange }
        />
    </main>

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

<style scoped>
    @import './page.css';

    /* Стили селектора сортировки */
#sort-select,
#sort-select-m {
    width: 100%;
    padding: .55rem .9rem;
    font-size: .95rem;
    font-weight: 600;
    line-height: 1.2;
    color: var(--blue);
    background: var(--white);
    border: 2px solid var(--gray, #e5e7eb);
    border-radius: 10px;
    outline: none;
    cursor: pointer;
    transition: border-color .2s, box-shadow .2s, background .2s;
    appearance: none;
    position: relative;
}

#sort-select:focus,
#sort-select-m:focus {
    border-color: var(--light-blue);
    box-shadow: 0 6px 24px rgba(7,92,239,0.14);
    background: var(--light-gray);
}

#sort-select:hover,
#sort-select-m:hover {
    border-color: var(--light-blue);
}

#sort-select option,
#sort-select-m option {
    font-weight: 600;
    background: var(--white);
    color: var(--dark);
}

/* Обёртка (если нужно выделить область) */
.filter_case select#sort-select,
.filter_case select#sort-select-m {
    grid-column: 1 / -1;
}

/* Мобильный селектор */
@media (max-width: 900px) {
    #sort-select {
        display: none;
    }
    #sort-select-m {
        font-size: 1rem;
        border-radius: 12px;
    }
}
</style>