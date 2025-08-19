<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { notification, NotificationType } from '$lib/utils/notifications/notification';
    import { api } from '$lib/utils/api';
    
    // Состояние
    let bots: any[] = [];
    let loading: boolean = true;
    let error: boolean = false;
    let isMobile: boolean = false;
    
    // Форма добавления бота
    let newBotName: string = '';
    let isAddingBot: boolean = false;
    
    // Поиск
    let searchQuery: string = '';
    let focused: boolean = false;
    
    // Пагинация
    let currentPage: number = 1;
    let totalPages: number = 1;
    let itemsPerPage: number = 10;
    
    // Модальные окна
    let showDeleteModal: boolean = false;
    let deletingBot: any = null;
    
    async function loadBots() {
        loading = true;
        error = false;
        bots = [];
        
        try {
            const response = await api.get('/api/v1/admin/bots', {
                page: currentPage,
                page_size: itemsPerPage,
                search: searchQuery?.trim() || undefined
            });
        
            if (response.success) {
                const data = response.data as { items: any[]; max_page: number };
                bots = data.items || [];
                totalPages = data.max_page || 1;
            } else {
                if (response.status === 404) {
                    bots = [];
                    totalPages = 1;
                } else if (response.status === 0) {
                    error = true;
                } else {
                    error = true;
                    notification('Ошибка при загрузке ботов', NotificationType.Error);
                }
            }
        } catch (err: any) {
            if (err?.status === 404 || 
                err?.response?.status === 404 || 
                (err?.message && (err.message.includes('404') || err.message.includes('not found')))) {
                bots = [];
                totalPages = 1;
            } else {
                error = true;
            }
        } finally {
            loading = false;
        }
    }
    
    function changePage(page: number) {
        if (page !== currentPage && page > 0 && page <= totalPages) {
            currentPage = page;
            loadBots();
        }
    }
    
    async function createBot() {
        if (!newBotName.trim()) {
            notification('Пожалуйста, введите имя бота', NotificationType.Error);
            return;
        }
        
        isAddingBot = true;
        
        try {
            const response = await api.post('/api/v1/admin/bots', {
                name: newBotName
            });
            
            if (response.success) {
                notification('Бот успешно создан', NotificationType.Success);
                newBotName = '';
                await loadBots();
            } else {
                notification(response.error || 'Ошибка при создании бота', NotificationType.Error);
            }
        } catch (err) {
            notification('Не удалось создать бота', NotificationType.Error);
        } finally {
            isAddingBot = false;
        }
    }
    
    function openDeleteModal(bot: any) {
        deletingBot = bot;
        showDeleteModal = true;
    }
    
    function closeModals() {
        showDeleteModal = false;
        deletingBot = null;
    }
    
    async function deleteBot() {
        if (!deletingBot) return;
        
        try {
            const response = await api.delete(`/api/v1/admin/bots/${deletingBot.id}`);
            
            if (response.success) {
                notification('Бот успешно удален', NotificationType.Success);
                closeModals();
                await loadBots();
            } else {
                notification('Ошибка при удалении бота', NotificationType.Error);
            }
        } catch (err) {
            notification('Не удалось удалить бота', NotificationType.Error);
        }
    }
    
    function handleSearch() {
        currentPage = 1;
        loadBots();
    }

    function handleResize() {
        if (browser) {
            isMobile = window.innerWidth < 768;
        }
    }

    onMount(async () => {
        if (browser) {
            isMobile = window.innerWidth < 768;
            window.addEventListener('resize', handleResize);
        }
        await loadBots();
    });

    onDestroy(() => {
        if (browser) {
            window.removeEventListener('resize', handleResize);
        }
    });
</script>

<div class="bots-section">
    <h1>Управление ботами</h1>
    
    <div class="add-bot-section">
        <h3>Добавить бота</h3>
        <div class="add-bot-form">
            <div class="form-group">
                <label for="newBotName">Имя бота</label>
                <div class="input-group">
                    <input 
                        type="text" 
                        id="newBotName" 
                        placeholder="Введите имя бота" 
                        bind:value={ newBotName }
                        class="form-input"
                    />
                    <button 
                        class="btn btn-primary" 
                        on:click={ createBot } 
                        disabled={ isAddingBot || !newBotName?.trim() }
                    >
                        { isAddingBot ? 'Создание...' : 'Создать бота' }
                    </button>
                </div>
            </div>
        </div>
    </div>
    
    <div class="bots-list-section">
        <h3>Список ботов</h3>
        <div class="search-module">
            <div class="search-block">
                <input
                    type="text"
                    placeholder="Поиск по имени..."
                    bind:value={ searchQuery }
                    on:focus={ () => focused = true }
                    on:blur={ () => focused = false }
                    on:keydown={(e) => {
                        if (e.key === 'Enter')
                            handleSearch();
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
                    on:click={ () => searchQuery = '' }
                    tabindex="-1"
                >
                    <svg viewBox="0 0 24 24" width="22" height="22">
                        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
                        <line x1="6" y1="18" x2="18" y2="6" stroke="currentColor" stroke-width="2"/>
                    </svg>
                </button>
            </div>
        </div>
        
        {#if loading}
            <div class="loading-state">
                <div class="loader"></div>
                <p>Загрузка ботов...</p>
            </div>
        {:else if error}
            <div class="error-state">
                <p>Произошла ошибка при загрузке ботов</p>
                <button class="btn btn-primary" on:click={ loadBots }>Попробовать снова</button>
            </div>
        {:else if bots.length === 0}
            <div class="empty-state">
                <p>Ботов ещё нет</p>
            </div>
        {:else}
            <div class="bots-table-container">
                <table class="bots-table">
                    <thead>
                        <tr>
                            <th>Имя</th>
                            <th>Токен</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each bots as bot}
                            <tr>
                                <td class="bot-info-cell">
                                    <div class="bot-info">
                                        <span class="bot-name">{ bot.name || 'Без имени' }</span>
                                    </div>
                                </td>
                                <td class="token-cell">
                                    <div class="token-container">
                                        <code>{ bot.token }</code>
                                        <button 
                                            class="action-btn copy-btn" 
                                            on:click={() => {
                                                navigator.clipboard.writeText(bot.token);
                                                notification('Токен скопирован', NotificationType.Success);
                                            }}
                                            title="Копировать токен"
                                            aria-label="Копировать токен"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                            </svg>
                                        </button>
                                    </div>
                                </td>
                                <td class="actions-cell">
                                    <div class="actions-container">
                                        <button 
                                            class="action-btn delete-btn" 
                                            on:click={ () => openDeleteModal(bot) }
                                            title="Удалить"
                                            aria-label="Удалить бота"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
            
            {#if totalPages > 1}
                <div class="pagination-block">
                    {#if currentPage > 1}
                        <button aria-label="Назад" class="pagination-button" on:click={ () => changePage(currentPage - 1) }>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M416 160C416 147.1 408.2 135.4 396.2 130.4C384.2 125.4 370.5 128.2 361.3 137.3L201.3 297.3C188.8 309.8 188.8 330.1 201.3 342.6L361.3 502.6C370.5 511.8 384.2 514.5 396.2 509.5C408.2 504.5 416 492.9 416 480L416 160z"/></svg>
                        </button>
                    {/if}
                    <span>Стр. { currentPage } из { totalPages }</span>
                    {#if currentPage < totalPages}
                        <button aria-label="Вперёд" class="pagination-button" on:click={ () => changePage(currentPage + 1) }>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M224.5 160C224.5 147.1 232.3 135.4 244.3 130.4C256.3 125.4 270 128.2 279.1 137.4L439.1 297.4C451.6 309.9 451.6 330.2 439.1 342.7L279.1 502.7C269.9 511.9 256.2 514.6 244.2 509.6C232.2 504.6 224.5 492.9 224.5 480L224.5 160z"/></svg>
                        </button>
                    {/if}
                </div>
            {/if}
        {/if}
    </div>
    
    {#if showDeleteModal && deletingBot}
        <button class="modal-backdrop" on:click={ closeModals } aria-label="Close modal" type="button" on:keydown={(e) => e.key === 'Enter' && closeModals()}></button>
        <div class="modal" role="dialog" tabindex="0" on:click|stopPropagation on:keydown={ (e) => e.key === 'Escape' && closeModals() }>
            <div class="modal-header">
                <h3>Удаление бота</h3>
                <button class="modal-close" on:click={ closeModals }>×</button>
            </div>
            <div class="modal-body">
                <p>Вы уверены, что хотите удалить бота "{ deletingBot.name }"?</p>
                <p class="warning-text">Это действие нельзя отменить.</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" on:click={ closeModals }>Отмена</button>
                <button class="btn btn-danger" on:click={ deleteBot }>Удалить</button>
            </div>
        </div>
    {/if}
</div>

<style>
    @import './Bots.css';
</style>