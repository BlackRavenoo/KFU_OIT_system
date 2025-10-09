<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { page as pageStore } from '$app/stores';
    import { get } from 'svelte/store';
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import { fade, slide } from 'svelte/transition';

    import { formatDate, formatName, formatTitle, formatDescription } from '$lib/utils/validation/validate';
    import { isAuthenticated } from '$lib/utils/auth/storage/initial';
    import { pageTitle, pageDescription, buildings } from '$lib/utils/setup/stores';
    import { fetchTickets, fetchConsts } from '$lib/utils/tickets/api/get';
    import { statusOptions, statusPriority } from '$lib/utils/tickets/types';
    import { getTicketsFilters, setTicketsFilters, clearTicketsFilters } from '$lib/utils/tickets/stores';

    import SearchBar from '$lib/components/Search/Searchfield.svelte';
    import Pagination from '$lib/components/Search/Pagination.svelte';

    let tickets: any[] = [];
    let error: string | null = null;
    let sortConsts = [{ id: 0, name: 'Загрузка...' }];

    let filters = getTicketsFilters();
    let page = 1;
    let maxPage = 1;

    let filtersCollapsed = true;
    let isMobile = false;

    let { search, viewMode, sortOrder, selectedStatus, selectedBuildings, plannedFrom, plannedTo, page_size, selectedSort } = filters;

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

    async function handleFilterChange() {
        page = 1;
        updatePageUrl();
        const result = await fetchTickets(search, { page });
        tickets = result.tickets;
        maxPage = result.max_page;
    }

    async function handleToggleSort() {
        const filters = getTicketsFilters();
        const newOrder = filters.sortOrder === 'asc' ? 'desc' : 'asc';
        sortOrder = newOrder;
        setTicketsFilters({ ...filters, sortOrder: newOrder });
        
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
        
        page = 1;
        updatePageUrl();
        const result = await fetchTickets(search, { page });
        tickets = result.tickets;
        maxPage = result.max_page;
    }

    /**
     * Проверка ширины отображения для изменения макета
    */
    function checkMobile() {
        isMobile = window.innerWidth <= 900;
    }

    /**
     * Переключение макета фильтров
    */
    function toggleFiltersCollapsed() {
        filtersCollapsed = !filtersCollapsed;
    }

    onMount(async () => {
        pageTitle.set('Заявки | Система управления заявками ЕИ КФУ');
        pageDescription.set('Отслеживайте статус заявок, принимайте к выполнению новые. Настройте рабочее пространство под себя с множеством гибких фильтров и сортировок.');
        
        if (!$isAuthenticated) window.location.href = '/';

        checkMobile();
        window.addEventListener('resize', checkMobile);

        try {
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

            const consts = await fetchConsts();
            sortConsts = consts.order;
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        }
    });

    onDestroy(() => {
        window.removeEventListener('resize', checkMobile);

        pageTitle.set('ОИТ | Система управления заявками ЕИ КФУ');
        pageDescription.set('Система обработки заявок Отдела Информационных Технологий Елабужского института Казанского Федерального Университета. Система позволяет создавать заявки на услуги ОИТ, отслеживать их статус, получать советы для самостоятельного решения проблемы и многое другое.');
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
    {#if !isMobile || !filtersCollapsed}
        <aside class:collapsed={ filtersCollapsed && isMobile }
            in:slide={{ duration: 250 }}
            out:fade={{ duration: 200 }}>
            <button id="clear_filters" on:click={ handleClearFilters }>Сбросить</button>
            <div class="filter">
                <span class="filter_name">Статус</span>
                <div class="filter_case">
                    {#each statusOptions as status, i}
                        <input
                            type="radio"
                            name="filter-status"
                            value={ status.value }
                            id={ status.value + '-tickets' }
                            checked={ i === 0 }
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
                    <input
                        type="date"
                        id="planned-from"
                        name="planned-from"
                        bind:value={ plannedFrom }
                    />
                    <label for="planned-to">До</label>
                    <input
                        type="date"
                        id="planned-to"
                        name="planned-to"
                        bind:value={ plannedTo }
                    />
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
                    {#each sortConsts as sort}
                        <input
                            type="radio"
                            name="filter-sort"
                            id={ "sort-" + sort.id }
                            value={ sort.id }
                            bind:group={ selectedSort }
                            checked={ selectedSort === sort.id }
                        />
                        <label for={ "sort-" + sort.id }>{ sort.name }</label>
                    {/each}
                </div>
            </div>
            <button class="filter_access" on:click={ handleFilterChange }>Применить</button>
        </aside>
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
                            <div class="ticket-title">
                                { formatTitle(ticket.title) } 
                                <span class="{ statusPriority.find(option => option.serverValue === ticket.priority)?.value + '-status' || '' }">
                                    { statusOptions.find(option => option.serverValue === ticket.status)?.label || '' }
                                </span>
                            </div>
                            <div class="ticket-meta">
                                { formatName(ticket.author) ?? 'Без автора' } • { formatDate(ticket.planned_at) ?? 'Без даты' } • { ticket.building.name ?? 'Не указано' }
                            </div>
                            <div class="ticket-desc">
                                { formatDescription(ticket.description) }
                            </div>
                        </div>
                    {:else}
                        <div class="ticket-card 
                            { statusOptions.find(option => option.serverValue === ticket.status)?.value || '' }"
                            role="link"
                            tabindex="0"
                            aria-label={`Открыть заявку ${ ticket.title }`}
                            on:click={() => window.location.href = `/ticket/${ ticket.id }`}
                            on:keydown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ')
                                    window.location.href = `/ticket/${ ticket.id }`;
                            }}
                        >
                            <div class="ticket-title">{ formatTitle(ticket.title) }</div>
                            <div class="ticket-meta">
                                { formatName(ticket.author) ?? 'Без автора' } • { formatDate(ticket.planned_at) ?? 'Без даты' } • { ticket.building.name ?? 'Не указано' }
                            </div>
                            <div class="ticket-desc">
                                { formatDescription(ticket.description) }
                            </div>
                            <div class="status { statusPriority.find(option => option.serverValue === ticket.priority)?.value + '-status' || '' }"></div>
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
</div>

<style scoped>
    @import './page.css';
</style>