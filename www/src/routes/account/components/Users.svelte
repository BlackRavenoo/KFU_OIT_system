<script lang="ts">
    import { onMount } from 'svelte';
    import { notification, NotificationType } from '$lib/utils/notifications/notification';
    import { api } from '$lib/utils/api';
    import Avatar from '$lib/components/Avatar/Avatar.svelte';
    
    // Состояние
    let users: any[] = [];
    let loading = true;
    let error = false;
    
    // Форма добавления пользователя
    let newUserEmail = '';
    let isAddingUser = false;
    
    // Поиск
    let searchQuery = '';
    let filteredUsers: any[] = [];
    let focused = false;
    
    // Пагинация
    let currentPage = 1;
    let totalPages = 1;
    let itemsPerPage = 10;
    
    // Модальные окна
    let showEditModal = false;
    let showDeleteModal = false;
    let editingUser: any = null;
    let deletingUser: any = null;
    
    onMount(async () => {
        await loadUsers();
    });
    
    async function loadUsers() {
        loading = true;
        try {
            const response = await api.get('/api/v1/admin/users', {
                page: currentPage,
                page_size: itemsPerPage,
                search: searchQuery.trim() || undefined
            });
            
            if (response.success) {
                const data = response.data as { items: any[]; max_page: number };
                users = data.items || [];
                totalPages = data.max_page || 1;
                filteredUsers = [...users];
            } else {
                notification('Ошибка при загрузке пользователей', NotificationType.Error);
                error = true;
            }
        } catch (err) {
            console.error('Error loading users:', err);
            notification('Не удалось загрузить список пользователей', NotificationType.Error);
            error = true;
        } finally {
            loading = false;
        }
    }
    
    function changePage(page: number) {
        if (page !== currentPage && page > 0 && page <= totalPages) {
            currentPage = page;
            loadUsers();
        }
    }
    
    async function sendInvitation() {
        if (!validateEmail(newUserEmail)) {
            notification('Пожалуйста, введите корректный email', NotificationType.Error);
            return;
        }
        
        isAddingUser = true;
        
        try {
            const response = await api.post('/api/v1/admin/users/invite', {
                email: newUserEmail
            });
            
            if (response.success) {
                notification('Приглашение успешно отправлено', NotificationType.Success);
                newUserEmail = '';
                await loadUsers();
            } else {
                notification(response.error || 'Ошибка при отправке приглашения', NotificationType.Error);
            }
        } catch (err) {
            notification('Не удалось отправить приглашение', NotificationType.Error);
        } finally {
            isAddingUser = false;
        }
    }
    
    function validateEmail(email: string): boolean {
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return re.test(email);
    }
    
    function openEditModal(user: any) {
        editingUser = { ...user };
        showEditModal = true;
    }
    
    function openDeleteModal(user: any) {
        deletingUser = user;
        showDeleteModal = true;
    }
    
    function closeModals() {
        showEditModal = false;
        showDeleteModal = false;
        editingUser = null;
        deletingUser = null;
    }
    
    async function updateUser() {
        if (!editingUser) return;
        
        try {
            const response = await api.post(`/api/v1/admin/users/${editingUser.id}/update`, {
                role: editingUser.role
            });
            
            if (response.success) {
                notification('Пользователь успешно обновлен', NotificationType.Success);
                closeModals();
                await loadUsers();
            } else {
                notification('Ошибка при обновлении пользователя', NotificationType.Error);
            }
        } catch (err) {
            notification('Не удалось обновить пользователя', NotificationType.Error);
        }
    }
    
    async function deleteUser() {
        if (!deletingUser) return;
        
        try {
            const response = await api.delete(`/api/v1/admin/users/${deletingUser.id}`);
            
            if (response.success) {
                notification('Пользователь успешно удален', NotificationType.Success);
                closeModals();
                await loadUsers();
            } else {
                notification('Ошибка при удалении пользователя', NotificationType.Error);
            }
        } catch (err) {
            notification('Не удалось удалить пользователя', NotificationType.Error);
        }
    }
    
    function handleSearch() {
        currentPage = 1;
        loadUsers();
    }
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
                        on:click={ sendInvitation } 
                        disabled={ isAddingUser || !newUserEmail.trim() }
                    >
                        { isAddingUser ? 'Отправка...' : 'Отправить приглашение' }
                    </button>
                </div>
                <p class="help-text">На указанный email будет отправлено приглашение для регистрации</p>
            </div>
        </div>
    </div>
    
    <div class="users-list-section">
        <h3>Список пользователей</h3>
        <div class="search-module">
            <div class="search-block">
                <input
                    type="text"
                    placeholder="Поиск по имени или email..."
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
                    <thead>
                        <tr>
                            <th>Пользователь</th>
                            <th>Email</th>
                            <th>Роль</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each filteredUsers as user}
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
                                        <button 
                                            class="action-btn edit-btn" 
                                            on:click={ () => openEditModal(user) }
                                            title="Редактировать"
                                            aria-label="Редактировать пользователя"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        </button>
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
    
    {#if showEditModal && editingUser}
        <button 
            class="modal-backdrop" 
            on:click={ closeModals } 
            on:keydown={ (e) => e.key === 'Enter' && closeModals() } 
            aria-label="Close modal" 
            type="button">
        </button>
        <div class="modal" on:click|stopPropagation role="dialog" aria-modal="true" tabindex="0" on:keydown={ (e) => e.key === 'Escape' && closeModals() }>
            <div class="modal-header">
                <h3>Редактирование пользователя</h3>
                <button class="modal-close" on:click={ closeModals }>×</button>
            </div>
            <div class="modal-body">
                <div class="user-edit-info">
                    <Avatar width={ 64 } round={ true } userFullName={ editingUser.name || 'Пользователь' } />
                    <div class="user-details">
                        <h4>{ editingUser.name || 'Без имени' }</h4>
                        <p>{ editingUser.email }</p>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="userRole">Роль пользователя</label>
                    <select id="userRole" class="form-select" bind:value={ editingUser.role }>
                        <option value="User">Пользователь</option>
                        <option value="Admin">Администратор</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" on:click={ closeModals }>Отмена</button>
                <button class="btn btn-primary" on:click={ updateUser }>Сохранить</button>
            </div>
        </div>
    {/if}
    
    {#if showDeleteModal && deletingUser}
        <button class="modal-backdrop" on:click={ closeModals } aria-label="Close modal" type="button" on:keydown={(e) => e.key === 'Enter' && closeModals()}></button>
        <div class="modal" role="dialog" tabindex="0" on:click|stopPropagation on:keydown={ (e) => e.key === 'Escape' && closeModals() }>
            <div class="modal-header">
                <h3>Удаление пользователя</h3>
                <button class="modal-close" on:click={ closeModals }>×</button>
            </div>
            <div class="modal-body">
                <p>Вы уверены, что хотите удалить пользователя { deletingUser.name || deletingUser.email} ?</p>
                <p class="warning-text">Это действие нельзя отменить.</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" on:click={ closeModals }>Отмена</button>
                <button class="btn btn-danger" on:click={ deleteUser }>Удалить</button>
            </div>
        </div>
    {/if}
</div>

<style>
    @import './Users.css';
</style>