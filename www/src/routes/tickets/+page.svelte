<script lang="ts">
    import { onMount } from 'svelte';

    let tickets: any[] = [];
    let error: string | null = null;

    let search = '';
    let focused = false;
    let viewMode: 'cards' | 'list' = 'cards';
    let sortOrder: 'asc' | 'desc' = 'asc';

    onMount(async () => {
        try {
            const params = new URLSearchParams({
                page: '1',
                per_page: '10'
            });

            const res = await fetch(`/api/v1/tickets/?${params.toString()}`, { credentials: 'include' });
            if (!res.ok) throw new Error('Ошибка загрузки тикетов');
            const data = await res.json();
            tickets = data.items ?? [];
        } catch (e) {
            if (e instanceof Error)
                error = e.message || 'Ошибка';
        }

        try {
            const res = await fetch('/api/v1/tickets/consts', { credentials: 'include' });
            if (!res.ok) throw new Error('Ошибка загрузки контактов');
            const consts = await res.json();
        } catch (e) {
            if (e instanceof Error)
                error = e.message || 'Ошибка при загрузке контактов';
        }
    });
</script>

<div id="content-panel">
    <aside>
        <div class="filter">
            <span class="filter_name">Статус</span>
            <div class="filter_case">
                <input type="radio" name="filter-status" value="all" id="all-tickets" checked>
                <label for="all-tickets">Все</label>
                <input type="radio" name="filter-status" value="active" id="active-tickets">
                <label for="active-tickets">Активные</label>
                <input type="radio" name="filter-status" value="ongoing" id="ongoing-tickets">
                <label for="ongoing-tickets">В процессе</label>
                <input type="radio" name="filter-status" value="complete" id="complete-tickets">
                <label for="complete-tickets">Выполненные</label>
                <input type="radio" name="filter-status" value="reject" id="reject-tickets">
                <label for="reject-tickets">Отклонённые</label>
            </div>
        </div>
        <div class="filter">
            <span class="filter_name">Сроки</span>
            <div class="filter_case">
                <input type="checkbox" name="filter-date" value="has-date" id="has-date" checked>
                <label for="has-date">Со сроком</label>
                <input type="checkbox" name="filter-date" value="no-date" id="no-date" checked>
                <label for="no-date">Без срока</label>
            </div>
        </div>
        <div class="filter">
            <span class="filter_name">Здание</span>
            <div class="filter_case">
                <input type="checkbox" name="filter-building" value="building-1" id="building-1" checked>
                <label for="building-1">Главный корпус</label>
                <input type="checkbox" name="filter-building" value="building-2" id="building-2" checked>
                <label for="building-2">Биофак</label>
                <input type="checkbox" name="filter-building" value="building-3" id="building-3" checked>
                <label for="building-3">Психфак</label>
                <input type="checkbox" name="filter-building" value="building-4" id="building-4" checked>
                <label for="building-4">Школа</label>
                <input type="checkbox" name="filter-building" value="building-5" id="building-5" checked>
                <label for="building-5">УСК</label>
                <input type="checkbox" name="filter-building" value="building-6" id="building-6" checked>
                <label for="building-6">Общежитие №1</label>
                <input type="checkbox" name="filter-building" value="building-7" id="building-7" checked>
                <label for="building-7">Общежитие №2</label>
                <input type="checkbox" name="filter-building" value="building-8" id="building-8" checked>
                <label for="building-8">Кафе</label>
                <input type="checkbox" name="filter-building" value="building-9" id="building-9" checked>
                <label for="building-9">Буревестник</label>
            </div>
        </div>
    </aside>
    <main>
        <div class="search-module">
            <div class="search-block">
                <input
                    type="text"
                    placeholder="Поиск по заявкам..."
                    bind:value={search}
                    on:focus={() => focused = true}
                    on:blur={() => focused = false}
                />
                <svg class="search-icon" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/>
                    <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="2"/>
                </svg>
                <button
                    type="button"
                    class="clear-icon-btn"
                    aria-label="Очистить поиск"
                    on:click={() => search = ''}
                    tabindex="-1"
                >
                    <svg viewBox="0 0 24 24" width="22" height="22">
                        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
                        <line x1="6" y1="18" x2="18" y2="6" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </button>
            </div>
            <div class="search-controls">
                <button
                    type="button"
                    class="sort-order-btn"
                    aria-label="Сменить порядок сортировки"
                    on:click={() => sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'}
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
                    on:click={() => viewMode = viewMode === 'cards' ? 'list' : 'cards'}
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
        <div class="tickets-list">
            <!-- Заявки -->
            <div class="ticket-card">
                <div class="ticket-title">Заголовок заявки</div>
                <div class="ticket-meta">Автор • Дата • Здание</div>
                <div class="ticket-desc">Описание заявки...</div>
                <div class="status low-status"></div>
            </div>
            <div class="ticket-card expired-ticket">
                <div class="ticket-title">Заголовок заявки</div>
                <div class="ticket-meta">Автор • Дата • Здание</div>
                <div class="ticket-desc">Описание заявки...</div>
                <div class="status medium-status"></div>
            </div>
            <div class="ticket-card">
                <div class="ticket-title">Заголовок заявки</div>
                <div class="ticket-meta">Автор • Дата • Здание</div>
                <div class="ticket-desc">Описание заявки...</div>
                <div class="status high-status"></div>
            </div>
            <div class="ticket-card">
                <div class="ticket-title">Заголовок заявки</div>
                <div class="ticket-meta">Автор • Дата • Здание</div>
                <div class="ticket-desc">Описание заявки...</div>
                <div class="status low-status"></div>
            </div>
            <div class="ticket-card canceled-ticket">
                <div class="ticket-title">Заголовок заявки</div>
                <div class="ticket-meta">Автор • Дата • Здание</div>
                <div class="ticket-desc">Описание заявки...</div>
                <div class="status low-status"></div>
            </div>
            <div class="ticket-card complete-ticket">
                <div class="ticket-title">Заголовок заявки</div>
                <div class="ticket-meta">Автор • Дата • Здание</div>
                <div class="ticket-desc">Описание заявки...</div>
                <div class="status low-status"></div>
            </div>
            <div class="ticket-card complete-ticket">
                <div class="ticket-title">Заголовок заявки</div>
                <div class="ticket-meta">Автор • Дата • Здание</div>
                <div class="ticket-desc">Описание заявки...</div>
                <div class="status medium-status"></div>
            </div>
        </div>
        <div class="pagination-block">
            <!-- Управление страницами -->
            <button aria-label="Назад" class="pagination-button">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M416 160C416 147.1 408.2 135.4 396.2 130.4C384.2 125.4 370.5 128.2 361.3 137.3L201.3 297.3C188.8 309.8 188.8 330.1 201.3 342.6L361.3 502.6C370.5 511.8 384.2 514.5 396.2 509.5C408.2 504.5 416 492.9 416 480L416 160z"/></svg>
            </button>
            <span>Стр. 1 из 10</span>
            <button aria-label="Вперёд" class="pagination-button">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M224.5 160C224.5 147.1 232.3 135.4 244.3 130.4C256.3 125.4 270 128.2 279.1 137.4L439.1 297.4C451.6 309.9 451.6 330.2 439.1 342.7L279.1 502.7C269.9 511.9 256.2 514.6 244.2 509.6C232.2 504.6 224.5 492.9 224.5 480L224.5 160z"/></svg>
            </button>
        </div>
    </main>
</div>

<style scoped>
    @import './page.css';
</style>

<!-- {#if error}
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
{/if} -->