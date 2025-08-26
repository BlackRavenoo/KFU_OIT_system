<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import SearchBar from '$lib/components/Search/Searchfield.svelte';
    import Pagination from '$lib/components/Search/Pagination.svelte';
    import Confirmation from '$lib/components/Modal/Confirmation.svelte';
    
    import {
        loadBotsData,
        createBotData,
        deleteBotData,
        copyTokenToClipboard,
        type Bot,
        type BotsState
    } from '$lib/utils/admin/bots';
    
    let bots: Bot[] = [];
    let loading: boolean = true;
    let error: boolean = false;
    let isMobile: boolean = false;
    
    let newBotName: string = '';
    let isAddingBot: boolean = false;
    
    let searchQuery: string = '';
    let currentPage: number = 1;
    let totalPages: number = 1;
    let itemsPerPage: number = 10;
    
    let showDeleteModal: boolean = false;
    let deletingBot: Bot | null = null;
    
    /**
     * Загрузка списка ботов
     */
    async function loadBots() {
        loading = true;
        error = false;

        const state: BotsState = await loadBotsData(currentPage, itemsPerPage, searchQuery);
        bots = state.bots;
        totalPages = state.totalPages;
        error = state.error;
        loading = false;
    }
    
    /**
     * Переход по страницам
     */
    function changePage(page: number) {
        if (page !== currentPage && page > 0 && page <= totalPages) {
            currentPage = page;
            loadBots();
        }
    }
    
    /**
     * Создание нового бота
     */
    async function createBot() {
        isAddingBot = true;
        
        const success = await createBotData({
            name: newBotName.trim()
        });
        
        if (success) {
            newBotName = '';
            await loadBots();
        }
        
        isAddingBot = false;
    }
    
    /**
     * Открытие модального окна удаления бота
     */
    function openDeleteModal(bot: Bot) {
        deletingBot = bot;
        showDeleteModal = true;
    }
    
    /**
     * Закрытие всех модальных окон
     */
    function closeModals() {
        showDeleteModal = false;
        deletingBot = null;
    }
    
    /**
     * Удаление бота
     */
    async function deleteBot() {
        if (!deletingBot) return;
        
        const success = await deleteBotData(deletingBot.id);
        
        if (success) {
            closeModals();
            await loadBots();
        }
    }
    
    /**
     * Обработка поиска
     */
    function handleSearch() {
        currentPage = 1;
        loadBots();
    }
    
    /**
     * Обработка изменения размера окна
     */
    function handleResize() {
        if (browser) isMobile = window.innerWidth < 768;
    }
  
    /**
     * Инициализация компонента
     */
    onMount(async () => {
        if (browser) {
            isMobile = window.innerWidth < 768;
            window.addEventListener('resize', handleResize);
        }
        await loadBots();
    });
  
    /**
     * Удаление обработчика события при размонтировании компонента
     */
    onDestroy(() => {
        browser && window.removeEventListener('resize', handleResize);
    });
</script>

<div class="bots-section">
    <h1>Управление ботами</h1>
    
    <div class="add-bot-section">
        <h3>Добавить бота</h3>
        <div class="add-bot-form">
            <div class="form-row">
                <div class="form-group">
                    <label for="newBotName">Имя бота</label>
                    <input 
                        type="text" 
                        id="newBotName" 
                        placeholder="Введите имя бота" 
                        bind:value={ newBotName }
                        class="form-input"
                    />
                </div>
                
                <button 
                    class="btn btn-primary" 
                    on:click={ createBot } 
                    disabled={ isAddingBot || !newBotName.trim() }
                >
                    { isAddingBot ? 'Добавление...' : 'Добавить бота' }
                </button>
            </div>
            <p class="help-text">Добавьте бота для интеграции с внешними системами</p>
        </div>
    </div>
    
    <div class="bots-list-section">
        <h3>Список ботов</h3>
        
        <SearchBar 
            bind:searchQuery
            placeholder="Поиск по имени бота..."
            onSearch={ handleSearch }
        />
        
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
                <p>Боты не найдены</p>
            </div>
        {:else}
            <div class="bots-table-container">
                <table class="bots-table">
                    <thead>
                        <tr>
                            <th>Имя</th>
                            <th>Токен</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each bots as bot}
                            <tr>
                                <td>{ bot.name }</td>
                                <td>
                                    <div class="token-cell">
                                        <span class="token-mask">••••••••{ bot.token.substring(bot.token.length - 6) }</span>
                                        <button 
                                            class="copy-token-btn" 
                                            on:click={ () => copyTokenToClipboard(bot.token) }
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
                                <td>
                                    <span class="status-badge { bot.active ? 'active' : 'inactive' }">
                                        { bot.active ? 'Активен' : 'Неактивен' }
                                    </span>
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
            
            <Pagination 
                { currentPage }
                { totalPages }
                onPageChange={ changePage }
            />
        {/if}
    </div>
    
    {#if showDeleteModal && deletingBot}
        <Confirmation
            title="Удаление бота"
            message={`Вы уверены, что хотите удалить бота "${ deletingBot.name }"?`}
            confirmText="Удалить"
            cancelText="Отмена"
            onConfirm={ deleteBot }
            onCancel={ closeModals }
        />
    {/if}
</div>

<style>
    @import './Bots.css';
</style>