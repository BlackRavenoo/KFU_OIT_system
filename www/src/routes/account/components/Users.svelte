<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    
    import Avatar from '$lib/components/Avatar/Avatar.svelte';
    import SearchBar from '$lib/components/Search/Searchfield.svelte';
    import Pagination from '$lib/components/Search/Pagination.svelte';
    import Confirmation from '$lib/components/Modal/Confirmation.svelte';
    
    import {
      loadUsersData,
      sendInvitation,
      deleteUserData,
      type User,
      type UsersState
    } from '$lib/utils/admin/users';
    
    let users: User[] = [];
    let loading: boolean = true;
    let error: boolean = false;
    let isMobile: boolean = false;
    
    let newUserEmail: string = '';
    let isAddingUser: boolean = false;
    
    let searchQuery: string = '';
    
    let currentPage: number = 1;
    let totalPages: number = 1;
    let itemsPerPage: number = 10;
    
    let showDeleteModal: boolean = false;
    let deletingUser: User | null = null;
    
    /**
     * Загрузка списка пользователей
     */
    async function loadUsers() {
        loading = true;
        error = false;

        const state: UsersState = await loadUsersData(currentPage, itemsPerPage, searchQuery);
        users = state.users;
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
            loadUsers();
        }
    }
    
    /**
     * Отправка приглашения на email
     */
    async function handleSendInvitation() {
        isAddingUser = true;

        const success = await sendInvitation(newUserEmail);

        if (success) {
            newUserEmail = '';
            await loadUsers();
        }

        isAddingUser = false;
    }
    
    /**
     * Открытие модального окна удаления пользователя
     */
    function openDeleteModal(user: User) {
        deletingUser = user;
        showDeleteModal = true;
    }
    
    /**
     * Закрытие всех модальных окон
     */
    function closeModals() {
        showDeleteModal = false;
        deletingUser = null;
    }
    
    /**
     * Удаление пользователя
     */
    async function deleteUser() {
        if (!deletingUser) return;

        const success = await deleteUserData(deletingUser.id);
        
        if (success) {
            closeModals();
            await loadUsers();
        }
    }
    
    /**
     * Обработка поиска
     */
    function handleSearch() {
        currentPage = 1;
        loadUsers();
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
        await loadUsers();
    });
  
    /**
     * Удаление обработчика события при размонтировании компонента
     */
    onDestroy(() => {
        browser && window.removeEventListener('resize', handleResize);
    });
</script>

<div class="users-section">
    <h1>Управление пользователями</h1>
    
    <div class="add-user-section">
        <h3>Добавить пользователя</h3>
        <div class="add-user-form">
            <div class="form-group">
                <label for="newUserEmail">Email пользователя</label>
                <div class="input-group">
                    <input 
                        type="email" 
                        id="newUserEmail" 
                        placeholder="Введите email" 
                        bind:value={ newUserEmail }
                        class="form-input"
                    />
                    <button 
                        class="btn btn-primary" 
                        on:click={ handleSendInvitation } 
                        disabled={ isAddingUser || !newUserEmail?.trim() }
                    >
                        { isAddingUser ? 'Отправка...' : isMobile ? 'Отправить' : 'Отправить приглашение' }
                    </button>
                </div>
                <p class="help-text">На указанный email будет отправлено приглашение для регистрации</p>
            </div>
        </div>
    </div>
    
    <div class="users-list-section">
        <h3>Список пользователей</h3>
        
        <SearchBar 
            bind:searchQuery
            placeholder="Поиск по имени или email..."
            onSearch={handleSearch}
        />
        
        {#if loading}
            <div class="loading-state">
                <div class="loader"></div>
                <p>Загрузка пользователей...</p>
            </div>
        {:else if error}
            <div class="error-state">
                <p>Произошла ошибка при загрузке пользователей</p>
                <button class="btn btn-primary" on:click={ loadUsers }>Попробовать снова</button>
            </div>
        {:else if users.length === 0}
            <div class="empty-state">
                <p>Пользователи не найдены</p>
            </div>
        {:else}
            <div class="users-table-container">
                <table class="users-table">
                    <tbody>
                        {#each users as user}
                            <tr>
                                <td class="user-info-cell">
                                    <div class="user-info">
                                        <Avatar width={ 36 } round={ true } userFullName={ user.name || 'Пользователь' } />
                                        <span class="user-name">{ user.name || 'Без имени' }</span>
                                    </div>
                                </td>
                                <td>{ user.email }</td>
                                <td>
                                    <span class="role-badge { user.role === 'Admin' ? 'admin-role' : 'user-role' }">
                                        { user.role === 'Admin' ? 'Администратор' : 'Пользователь' }
                                    </span>
                                </td>
                                <td class="actions-cell">
                                    <div class="actions-container">
                                        {#if user.role !== "Admin"}
                                            <button 
                                                class="action-btn promote-btn" 
                                                on:click={ () => console.log("test") }
                                                title="Повысить"
                                                aria-label="Повысить роль пользователя"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <path d="M12 4v16"></path>
                                                    <path d="M5 10l7-7 7 7"></path>
                                                    <path d="M18 20H6"></path>
                                                </svg>
                                            </button>
                                        {/if}
                                    </div>
                                </td>
                                <td class="actions-cell">
                                    <div class="actions-container">
                                        {#if user.role !== "User"}
                                            <button 
                                                class="action-btn demote-btn" 
                                                on:click={ () => console.log("test") }
                                                title="Понизить"
                                                aria-label="Понизить роль пользователя"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <path d="M12 20V4"></path>
                                                    <path d="M5 14l7 7 7-7"></path>
                                                    <path d="M18 4H6"></path>
                                                </svg>
                                            </button>
                                        {/if}
                                        </div>
                                    </td>
                                <td class="actions-cell">
                                    <div class="actions-container">
                                        <button 
                                            class="action-btn delete-btn" 
                                            on:click={ () => openDeleteModal(user) }
                                            title="Удалить"
                                            aria-label="Удалить пользователя"
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
    
    {#if showDeleteModal && deletingUser}
        <Confirmation
            title="Удаление пользователя"
            message={`Вы уверены, что хотите удалить пользователя ${ deletingUser.name || deletingUser.email }?`}
            confirmText="Удалить"
            cancelText="Отмена"
            onConfirm={ deleteUser }
            onCancel={ closeModals }
        />
    {/if}
</div>

<style>
    @import './Users.css';
</style>