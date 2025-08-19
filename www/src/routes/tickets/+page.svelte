<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { page as pageStore } from '$app/stores';
    import { get } from 'svelte/store';
    import { goto } from '$app/navigation';
    
    import { formatDate } from '$lib/utils/tickets/support';
    import { isAuthenticated } from '$lib/utils/auth/storage/initial';
    import { pageTitle, pageDescription, buildings } from '$lib/utils/setup/stores';
    import { fetchTickets, fetchConsts } from '$lib/utils/tickets/api/get';
    import { statusOptions, statusPriority } from '$lib/utils/tickets/types';
    import { getTicketsFilters, setTicketsFilters, clearTicketsFilters } from '$lib/utils/tickets/stores';
    import { browser } from '$app/environment';

    let tickets: any[] = [];
    let error: string | null = null;
    let focused: boolean = false;
    let sortConsts = [{ id: 0, name: 'Загрузка...' }];

    let filters = getTicketsFilters();
    let page = 1;
    let max_page = 1;

    let { search, viewMode, sortOrder, selectedStatus, selectedBuildings, plannedFrom, plannedTo, page_size, selectedSort } = filters;

    /**
     * Реактивное выражение для обновления фильтров тикетов.
    */
    $: setTicketsFilters({ search, viewMode, sortOrder, selectedStatus, selectedBuildings, plannedFrom, plannedTo, page_size, selectedSort, page });

    /**
     * Реактивное выражение для обновления параметра page из URL.
    */
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

    /**
     * Обновляет URL страницы с учётом текущих параметров поиска и пагинации.
     * Если текущая страница - первая, удаляет параметр page из URL.
     */
    function updatePageUrl() {
        if (browser) {
            const url = new URL(window.location.href);
            page > 1 ?
                url.searchParams.set('page', page.toString()) :
                url.searchParams.delete('page');
            goto(url.toString(), { replaceState: true, keepFocus: true });
        }
    }

    /**
     * Обработчик для перехода на предыдущую страницу тикетов.
     */
    async function handlePrevPage() {
        if (page > 1) {
            page -= 1;
            updatePageUrl();
            const result = await fetchTickets(search, { page });
            tickets = result.tickets;
            max_page = result.max_page;
        }
    }

    /**
     * Обработчик для перехода на следующую страницу тикетов.
     */
    async function handleNextPage() {
        if (page < max_page) {
            page += 1;
            updatePageUrl();
            const result = await fetchTickets(search, { page }); 
            tickets = result.tickets;
            max_page = result.max_page;
        }
    }

    /**
     * Обработчик изменения фильтров.
     * Вызывается по нажатию кнопки "Применить"
     */
    async function handleFilterChange() {
        page = 1;
        updatePageUrl();
        const result = await fetchTickets(search, { page });
        tickets = result.tickets;
        max_page = result.max_page;
    }

    /**
     * Обработчик для переключения порядка сортировки тикетов.
     */
    async function handleToggleSort() {
        const filters = getTicketsFilters();
        const newOrder = filters.sortOrder === 'asc' ? 'desc' : 'asc';
        sortOrder = newOrder;
        setTicketsFilters({ ...filters, sortOrder: newOrder });
        
        page = 1;
        updatePageUrl();
        const result = await fetchTickets(search, { page });
        tickets = result.tickets;
        max_page = result.max_page;
    }

    /**
     * Обработчик для сброса всех фильтров к стандартным значениям
     */
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
        max_page = result.max_page;
    }

    /**
     * Выставляет стартовые значения для фильтров и заголовка страницы.
     * Вызывается при монтировании компонента.
    */
    onMount(async () => {
        pageTitle.set('Заявки | Система управления заявками ЕИ КФУ');
        pageDescription.set('Отслеживайте статус заявок, принимайте к выполнению новые. Настройте рабочее пространство под себя с множеством гибких фильтров и сортировок.');
        
        if (!$isAuthenticated) window.location.href = '/';

        try {
            const result = await fetchTickets(search, { page });
            tickets = result.tickets;
            max_page = result.max_page;
            
            if (page > max_page && max_page > 0) {
                page = 1;
                updatePageUrl();
                const updatedResult = await fetchTickets(search, { page: 1 });
                tickets = updatedResult.tickets;
                max_page = updatedResult.max_page;
            }

            const consts = await fetchConsts();
            sortConsts = consts.order;
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        }
    });

    /**
     * Сбрасывает заголовок страницы и описание при размонтировании компонента.
    */
    onDestroy(() => {
        pageTitle.set('ОИТ | Система управления заявками ЕИ КФУ');
        pageDescription.set('Система обработки заявок Отдела Информационных Технологий Елабужского института Казанского Федерального Университета. Система позволяет создавать заявки на услуги ОИТ, отслеживать их статус, получать советы для самостоятельного решения проблемы и многое другое.');
    });
</script>

<div id="content-panel">
    <aside>
        <!-- Фильтр статуса -->
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
        <!-- Фильтр сроков -->
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
        <!-- Фильтр здания -->
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
        <!-- Сортировка -->
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
        <button class="filter_access" on:click="{ handleFilterChange }">Применить</button>
    </aside>
    <main>
        <!-- Поисковый блок -->
        <div class="search-module">
            <div class="search-block">
                <input
                    type="text"
                    placeholder="Поиск по заявкам..."
                    bind:value={ search }
                    on:focus={ () => focused = true }
                    on:blur={ () => focused = false }
                    on:keydown={(e) => {
                        if (e.key === 'Enter')
                            handleFilterChange();
                    }}
                />
                <svg class="search-icon" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/>
                    <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="2"/>
                </svg>
                <button
                    type="button"
                    class="clear-icon-btn"
                    aria-label="Очистить поиск"
                    on:click={ () => search = '' }
                    tabindex="-1"
                >
                    <svg viewBox="0 0 24 24" width="22" height="22">
                        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
                        <line x1="6" y1="18" x2="18" y2="6" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </button>
            </div>
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
        <!-- Тикеты -->
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
                            aria-label={`Открыть заявку ${ticket.title}`}
                            on:click={() => window.location.href = `/ticket/${ ticket.id }`}
                            on:keydown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ')
                                    window.location.href = `/ticket/${ ticket.id }`;
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
                            <div class="ticket-title">{ ticket.title  }</div>
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
            {/if}
        </div>
        <div class="pagination-block">
            <!-- Управление страницами -->
             {#if page > 1}
                <button aria-label="Назад" class="pagination-button" on:click="{ handlePrevPage }">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M416 160C416 147.1 408.2 135.4 396.2 130.4C384.2 125.4 370.5 128.2 361.3 137.3L201.3 297.3C188.8 309.8 188.8 330.1 201.3 342.6L361.3 502.6C370.5 511.8 384.2 514.5 396.2 509.5C408.2 504.5 416 492.9 416 480L416 160z"/></svg>
                </button>
            {/if}
            <span>Стр. { page } из { max_page }</span>
            {#if max_page > 1 && page < max_page}
                <button aria-label="Вперёд" class="pagination-button" on:click="{ handleNextPage }">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M224.5 160C224.5 147.1 232.3 135.4 244.3 130.4C256.3 125.4 270 128.2 279.1 137.4L439.1 297.4C451.6 309.9 451.6 330.2 439.1 342.7L279.1 502.7C269.9 511.9 256.2 514.6 244.2 509.6C232.2 504.6 224.5 492.9 224.5 480L224.5 160z"/></svg>
                </button>
            {/if}
        </div>
    </main>
</div>

<style scoped>
    @import './page.css';
</style>