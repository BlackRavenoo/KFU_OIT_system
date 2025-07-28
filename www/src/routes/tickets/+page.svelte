<script lang="ts">
    import { getAuthTokens } from '$lib/utils/auth/tokens/tokens';
    import { pageTitle, pageDescription } from '$lib/utils/setup/stores';
    
    import { onMount, onDestroy } from 'svelte';

    let tickets: any[] = [];
    let error: string | null = null;

    let search: string = '';
    let focused: boolean = false;
    let viewMode: 'cards' | 'list' = 'cards';
    let sortOrder: 'Asc' | 'Desc' = 'Asc';
    let selectedStatus: string = 'all';
    let selectedBuildings: string[] = [];
    let plannedFrom: string = '';
    let plannedTo: string = '';
    let page: number = 1;
    let page_size: number = 10;
    let max_page: number = 1;

    let sortConsts = [{ id: 0, name: 'Загрузка...' }];
    let selectedSort = 0;

    const orderByMap: Record<number, string> = {
        0: 'Id',
        1: 'PlannedAt',
        2: 'Priority'
    };

    function statusClass(status: string): string {
        switch (status.toLowerCase()) {
            case 'low': return 'low-status';
            case 'medium': return 'medium-status';
            case 'high': return 'high-status';
            case 'critical': return 'critical-status';
            case 'expired': return 'expired-ticket';
            case 'canceled': return 'canceled-ticket';
            case 'complete': return 'complete-ticket';
            default: return '';
        }
    }

    function formatDate(dateStr: string): string {
        if (!dateStr) return 'Без даты';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Без даты';
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function toRfc3339(dateStr: string, endOfDay = false) {
        if (!dateStr) return '';
        return endOfDay
            ? `${dateStr}T23:59:59Z`
            : `${dateStr}T00:00:00Z`;
    }

    function buildQuery(params: Record<string, any>) {
        const parts: string[] = [];
        for (const [key, value] of Object.entries(params)) {
            if (Array.isArray(value)) {
                value.forEach(v => parts.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(v)}`));
            } else {
                parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
            }
        }
        return parts.join('&');
    }

    async function fetchTickets() {
        const params: Record<string, any> = {
            page,
            page_size,
            order_by: orderByMap[selectedSort] || 'Id',
            sort_order: sortOrder,
        };

        if (selectedStatus !== 'all')
            params.statuses = [selectedStatus];

        if (plannedFrom) params.planned_from = toRfc3339(plannedFrom);
        if (plannedTo) params.planned_to = toRfc3339(plannedTo, true);

        if (selectedBuildings.length > 0)
            params.buildings = selectedBuildings;

        if (search) params.search = search;

        const query = buildQuery(params);

        const res = await fetch(`/api/v1/tickets/?${query}`, {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'authorization': `Bearer ${getAuthTokens()?.accessToken}`
            }
        });
        if (!res.ok) throw new Error('Ошибка загрузки тикетов');
        const data = await res.json();
        tickets = data.items ?? [];
        max_page = data.max_page ?? 1;
    }

    async function fetchConsts() {
        try {
            const res = await fetch('/api/v1/tickets/consts', { credentials: 'include' });
            if (!res.ok) throw new Error('Ошибка загрузки контактов');
            sortConsts = await res.json();
        } catch (e) {
            if (e instanceof Error)
                error = e.message || 'Ошибка при загрузке фильтров';
        }
    }

    async function handlePrevPage() {
        if (page > 1) page -= 1;
        fetchTickets();
    }

    async function handleNextPage() {
        if (page < max_page) page += 1;
        fetchTickets();
    }

    onMount(async () => {
        pageTitle.set('Заявки | Система управления заявками ЕИ КФУ');
        pageDescription.set('Отслеживайте статус заявок, принимайте к выполнению новые. Настройте работчее пространство под себя с множеством гибких фильтров и сортировок.');
        
        fetchTickets();
        fetchConsts();
    });

    /**
     * Удаляет все стили и восстанавливает метаданные страницы при уничтожении компонента.
     */
    onDestroy(() => {
        pageTitle.set('ОИТ | Система управления заявками ЕИ КФУ');
        pageDescription.set('Система обработки заявок Отдела Информационных Технологий Елабужского института Казанского Федерального Университета. Система позволяет создавать заявки на услуги ОИТ, отслеживать их статус, получать советы для самостоятельного решения проблемы и многое другое.');
    });
</script>

<div id="content-panel">
    <aside>
        <!-- Фильтр статуса -->
        <div class="filter">
            <span class="filter_name">Статус</span>
            <div class="filter_case">
                {#each [
                    { value: 'all', label: 'Все' },
                    { value: 'Open', label: 'Активные' },
                    { value: 'InProgress', label: 'В процессе' },
                    { value: 'Closed', label: 'Выполненные' },
                    { value: 'Cancelled', label: 'Отклонённые' }
                ] as status, i}
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
                {#each [
                    { value: 'building-1', label: 'Главный корпус' },
                    { value: 'building-2', label: 'Биофак' },
                    { value: 'building-3', label: 'Психфак' },
                    { value: 'building-4', label: 'Школа' },
                    { value: 'building-5', label: 'УСК' },
                    { value: 'building-6', label: 'Общежитие №1' },
                    { value: 'building-7', label: 'Общежитие №2' },
                    { value: 'building-8', label: 'Кафе' },
                    { value: 'building-9', label: 'Буревестник' }
                ] as building}
                    <input
                        type="checkbox"
                        name="filter-building"
                        value={ building.value }
                        id={ building.value }
                        checked={ selectedBuildings.includes(building.value) }
                        on:change={() => {
                            if (selectedBuildings.includes(building.value)) {
                                selectedBuildings = selectedBuildings.filter(b => b !== building.value);
                            } else {
                                selectedBuildings = [...selectedBuildings, building.value];
                            }
                        }}
                    />
                    <label for={ building.value }>{ building.label }</label>
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
        <button class="filter_access" on:click="{ fetchTickets }">Применить</button>
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
                    on:click={ () => sortOrder = sortOrder === 'Asc' ? 'Desc' : 'Asc' }
                >
                    {#if sortOrder === 'Asc'}
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
        <div class="tickets-list">
            {#if error}
                <div>{ error }</div>
            {:else if tickets.length === 0}
                <div>Нет тикетов</div>
            {:else}
                {#each tickets as ticket}
                    <div class="ticket-card { statusClass(ticket.status) }">
                        <div class="ticket-title">{ticket.title}</div>
                        <div class="ticket-meta">
                            { ticket.author ?? 'Без автора' } • { formatDate(ticket.planned_at) ?? 'Без даты' } • { ticket.building ?? 'Не указано' }
                        </div>
                        <div class="ticket-desc">
                            {ticket.description.length > 100
                                ? ticket.description.slice(0, 100) + '...'
                                : ticket.description}
                        </div>
                        <div class="status { statusClass(ticket.priority) }"></div>
                    </div>
                {/each}
            {/if}
        </div>
        <div class="pagination-block">
            <!-- Управление страницами -->
            <button aria-label="Назад" class="pagination-button" on:click="{ handlePrevPage }">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M416 160C416 147.1 408.2 135.4 396.2 130.4C384.2 125.4 370.5 128.2 361.3 137.3L201.3 297.3C188.8 309.8 188.8 330.1 201.3 342.6L361.3 502.6C370.5 511.8 384.2 514.5 396.2 509.5C408.2 504.5 416 492.9 416 480L416 160z"/></svg>
            </button>
            <span>Стр. { page } из { max_page }</span>
            <button aria-label="Вперёд" class="pagination-button" on:click="{ handleNextPage }">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M224.5 160C224.5 147.1 232.3 135.4 244.3 130.4C256.3 125.4 270 128.2 279.1 137.4L439.1 297.4C451.6 309.9 451.6 330.2 439.1 342.7L279.1 502.7C269.9 511.9 256.2 514.6 244.2 509.6C232.2 504.6 224.5 492.9 224.5 480L224.5 160z"/></svg>
            </button>
        </div>
    </main>
</div>

<style scoped>
    @import './page.css';
</style>