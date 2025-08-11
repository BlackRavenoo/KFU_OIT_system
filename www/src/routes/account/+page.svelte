<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { fade } from 'svelte/transition';
    
    import { currentUser, isAuthenticated } from '$lib/utils/auth/storage/initial';
    import { pageTitle, pageDescription } from '$lib/utils/setup/stores';
    import { notification, NotificationType } from '$lib/utils/notifications/notification';
    import { logout } from '$lib/utils/auth/api/api';
    import { getUserData } from '$lib/utils/auth/api/api';
    
    import Avatar from '$lib/components/Avatar/Avatar.svelte';
    
    const Tab = {
        PROFILE: 'profile',
        TICKETS: 'tickets',
        STATISTICS: 'statistics'
    } as const;

    type Tab = typeof Tab[keyof typeof Tab];
    
    let activeTab: Tab = Tab.PROFILE;
    let isLoading: boolean = false;
    let isEditing: boolean = false;
    let activeTickets: any[] = [];
    
    let userName: string = '';
    let userRole: string = '';
    let editedName: string = '';
    let avatarFile: File | null = null;
    let avatarPreview: string | null = null;
    
    let stats = {
        totalTickets: 0,
        assignedToMe: 0,
        completedTickets: 0,
        cancelledTickets: 0
    };
    
    let isWideScreen = window.innerWidth > 768;
    
    function updateScreenWidth() {
        isWideScreen = window.innerWidth > 768;
    }
    
    function setTab(tab: Tab) {
        activeTab = tab;
    }
    
    function startEditingProfile() {
        editedName = $currentUser?.name || '';
        isEditing = true;
    }
    
    function cancelEditing() {
        editedName = '';
        avatarFile = null;
        avatarPreview = null;
        isEditing = false;
    }
    
    async function saveProfile() {
        isLoading = true;
        
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if ($currentUser) {
                $currentUser.name = editedName;
                notification('Профиль успешно обновлен', NotificationType.Success);
            }
            
            isEditing = false;
        } catch (error) {
            notification('Ошибка при обновлении профиля', NotificationType.Error);
        } finally {
            isLoading = false;
        }
    }
    
    function handleAvatarChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files[0]) {
            avatarFile = input.files[0];
            avatarPreview = URL.createObjectURL(avatarFile);
        }
    }
    
    async function handleLogout() {
        try {
            await logout();
            notification('Вы успешно вышли из системы', NotificationType.Success);
        } catch {
            notification('Ошибка при выходе из системы', NotificationType.Error);
        }
    }
    
    async function loadUserData() {
        if (!$isAuthenticated) {
            window.location.href = '/';
            return;
        }
        
        isLoading = true;
        
        try {
            const userData = await getUserData();
            userName = userData.name;
            userRole = userData.role === 0 ? 'Пользователь' : 'Администратор';
            
            await loadStatistics();
            await loadActiveTickets();
        } catch (error) {
            notification('Ошибка загрузки данных пользователя', NotificationType.Error);
        } finally {
            isLoading = false;
        }
    }
    
    async function loadStatistics() {
        // !!! TDD !!!
        stats = {
            totalTickets: Math.floor(Math.random() * 100),
            assignedToMe: Math.floor(Math.random() * 20),
            completedTickets: Math.floor(Math.random() * 80),
            cancelledTickets: Math.floor(Math.random() * 10)
        };
    }
    
    async function loadActiveTickets() {
        // !!! TDD !!!
        activeTickets = Array(5).fill(null).map((_, i) => ({
            id: i + 1,
            title: `Заявка №${i + 1}`,
            status: ['inprogress', 'new', 'inprogress', 'new', 'inprogress'][i],
            created_at: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
            building: { code: 'A' }
        }));
    }
    
    onMount(() => {
        pageTitle.set('Личный кабинет | Система управления заявками ЕИ КФУ');
        pageDescription.set('Управление личной учетной записью и просмотр статистики по заявкам.');
        
        loadUserData();
        window.addEventListener('resize', updateScreenWidth);
        
        return () => {
            window.removeEventListener('resize', updateScreenWidth);
        };
    });

    /**
     * Сбрасывает заголовок страницы и описание при размонтировании компонента.
    */
    onDestroy(() => {
        pageTitle.set('ОИТ | Система управления заявками ЕИ КФУ');
        pageDescription.set('Система обработки заявок Отдела Информационных Технологий Елабужского института Казанского Федерального Университета. Система позволяет создавать заявки на услуги ОИТ, отслеживать их статус, получать советы для самостоятельного решения проблемы и многое другое.');
    });
</script>

<div class="account-page">
    {#if isWideScreen}
        <!-- Desktop Layout -->
        <aside class="sidebar">
            <div class="user-profile">
                <Avatar width={80} round={true} userFullName={$currentUser?.name || 'Пользователь'} />
                <h2>{$currentUser?.name || 'Пользователь'}</h2>
                <span class="role-badge">{userRole}</span>
            </div>
            
            <nav class="side-nav">
                <button 
                    class={activeTab === Tab.PROFILE ? 'active' : ''} 
                    on:click={() => setTab(Tab.PROFILE)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    Профиль
                </button>
                
                <button 
                    class={activeTab === Tab.TICKETS ? 'active' : ''} 
                    on:click={() => setTab(Tab.TICKETS)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Мои заявки
                </button>
                
                <button 
                    class={activeTab === Tab.STATISTICS ? 'active' : ''} 
                    on:click={() => setTab(Tab.STATISTICS)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                    Статистика
                </button>
            </nav>
            
            <button class="logout-btn" on:click={handleLogout} aria-label="Выйти из системы">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                Выйти
            </button>
        </aside>
        
        <div class="main-content" transition:fade={{ duration: 200 }}>
            {#if isLoading}
                <div class="loader">Загрузка...</div>
            {:else}
                {#if activeTab === Tab.PROFILE}
                    <div class="content-section">
                        <h1>Личный кабинет</h1>
                        
                        <div class="profile-dashboard">
                            <div class="profile-section">
                                <h2>Информация профиля</h2>
                                {#if isEditing}
                                    <div class="edit-profile">
                                        <div class="edit-avatar">
                                            {#if avatarPreview}
                                                <img src={ avatarPreview } alt="Avatar preview" class="avatar-preview" />
                                            {:else}
                                                <Avatar width={ 100 } round={ true } userFullName={ $currentUser?.name || 'Пользователь' } />
                                            {/if}
                                            <label class="avatar-upload">
                                                Изменить аватар
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    style="display: none;" 
                                                    on:change={ handleAvatarChange }
                                                />
                                            </label>
                                        </div>
                                        
                                        <div class="form-group">
                                            <label for="name">Имя пользователя</label>
                                            <input 
                                                type="text" 
                                                id="name" 
                                                class="form-input" 
                                                bind:value={ editedName }
                                                placeholder="Введите имя"
                                            />
                                        </div>
                                        
                                        <div class="form-actions">
                                            <button class="btn btn-primary" on:click={ saveProfile } disabled={ isLoading }>
                                                { isLoading ? 'Сохранение...' : 'Сохранить' }
                                            </button>
                                            <button class="btn btn-secondary" on:click={ cancelEditing }>
                                                Отмена
                                            </button>
                                        </div>
                                    </div>
                                {:else}
                                    <div class="profile-info">
                                        <div class="info-item">
                                            <strong>Имя:</strong> { $currentUser?.name }
                                        </div>
                                        <div class="info-item">
                                            <strong>Email:</strong> { $currentUser?.email }
                                        </div>
                                        <div class="info-item">
                                            <strong>Роль:</strong> { userRole }
                                        </div>
                                        
                                        <button class="btn btn-primary" on:click={ startEditingProfile }>
                                            Редактировать профиль
                                        </button>
                                    </div>
                                {/if}
                            </div>
                            
                            <div class="profile-stats">
                                <div class="section-header">
                                    <h2>Моя статистика</h2>
                                    <a href="/tickets" class="view-all">Вся статистика</a>
                                </div>
                                <div class="stats-summary">
                                    <div class="stat-item">
                                        <div class="stat-value">{stats.assignedToMe}</div>
                                        <div class="stat-label">Назначено мне</div>
                                    </div>
                                    <div class="stat-item">
                                        <div class="stat-value">{stats.completedTickets}</div>
                                        <div class="stat-label">Завершено</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="active-tickets-section">
                            <div class="section-header">
                                <h2>Активные заявки</h2>
                                <a href="/tickets" class="view-all">Все заявки</a>
                            </div>
                            
                            {#if activeTickets.length > 0}
                                <div class="tickets-grid">
                                    {#each activeTickets.slice(0, 4) as ticket}
                                        <a href={`/tickets/${ticket.id}`} class="ticket-card">
                                            <div class="ticket-header">
                                                <span class="ticket-id">{ ticket.building.code }-{ ticket.id }</span>
                                                <span class={`status-badge ${ ticket.status }`}>
                                                    { ticket.status === 'new' ? 'Новая' : 'В работе' }
                                                </span>
                                            </div>
                                            <h3 class="ticket-title">{ ticket.title }</h3>
                                            <div class="ticket-footer">
                                                <span class="ticket-date">
                                                    { new Date(ticket.created_at).toLocaleDateString() }
                                                </span>
                                            </div>
                                        </a>
                                    {/each}
                                </div>
                            {:else}
                                <div class="empty-state">
                                    <p>У вас нет активных заявок</p>
                                    <a href="/tickets/create" class="btn btn-primary">Создать заявку</a>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/if}
                
                {#if activeTab === Tab.TICKETS}
                    <div class="content-section">
                        <h1>Мои заявки</h1>
                        
                        {#if activeTickets.length > 0}
                            <div class="tickets-list">
                                {#each activeTickets as ticket}
                                    <a href={`/tickets/${ ticket.id }`} class="ticket-list-item">
                                        <div class="ticket-list-header">
                                            <span class="ticket-id">{ ticket.building.code }-{ ticket.id }</span>
                                            <span class={`status-badge ${ ticket.status }`}>
                                                { ticket.status === 'new' ? 'Новая' : 'В работе' }
                                            </span>
                                        </div>
                                        <h3 class="ticket-title">{ ticket.title }</h3>
                                        <div class="ticket-list-footer">
                                            <span class="ticket-date">
                                                Создана: { new Date(ticket.created_at).toLocaleDateString() }
                                            </span>
                                        </div>
                                    </a>
                                {/each}
                            </div>
                        {:else}
                            <div class="empty-state">
                                <p>У вас нет активных заявок</p>
                                <a href="/tickets/create" class="btn btn-primary">Создать заявку</a>
                            </div>
                        {/if}
                    </div>
                {/if}
                
                {#if activeTab === Tab.STATISTICS}
                    <div class="content-section">
                        <h1>Моя статистика</h1>
                        
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-value">{ stats.totalTickets }</div>
                                <div class="stat-label">Всего заявок</div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-value">{ stats.assignedToMe }</div>
                                <div class="stat-label">Назначено мне</div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-value">{ stats.completedTickets }</div>
                                <div class="stat-label">Завершено</div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-value">{ stats.cancelledTickets }</div>
                                <div class="stat-label">Отменено</div>
                            </div>
                        </div>
                    </div>
                {/if}
            {/if}
        </div>
    {:else}
        <!-- Mobile Layout -->
        <header class="mobile-header">
            <div class="user-info">
                <Avatar width={ 40 } round={ true } userFullName={ $currentUser?.name || 'Пользователь' } />
                <div>
                    <h2>{ $currentUser?.name || 'Пользователь' }</h2>
                    <span class="role-badge">{ userRole }</span>
                </div>
            </div>
            <button class="logout-btn-mobile" on:click={ handleLogout } aria-label="Выход">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
        </header>
        
        <nav class="mobile-nav">
            <button 
                class={ activeTab === Tab.PROFILE ? 'active' : '' } 
                on:click={ () => setTab(Tab.PROFILE) }
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                <span>Профиль</span>
            </button>
            
            <button 
                class={ activeTab === Tab.TICKETS ? 'active' : '' } 
                on:click={ () => setTab(Tab.TICKETS) }
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <span>Заявки</span>
            </button>
            
            <button 
                class={ activeTab === Tab.STATISTICS ? 'active' : '' } 
                on:click={ () => setTab(Tab.STATISTICS) }
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                <span>Статистика</span>
            </button>
        </nav>
        
        <main class="mobile-content" transition:fade={{ duration: 200 }}>
            {#if isLoading}
                <div class="loader">Загрузка...</div>
            {:else}
                {#if activeTab === Tab.PROFILE}
                    <div class="content-section">
                        <h1>Личный кабинет</h1>
                        
                        <div class="profile-section">
                            <h2>Информация профиля</h2>
                            {#if isEditing}
                                <div class="edit-profile">
                                    <div class="edit-avatar">
                                        {#if avatarPreview}
                                            <img src={ avatarPreview } alt="Avatar preview" class="avatar-preview" />
                                        {:else}
                                            <Avatar width={ 80 } round={ true } userFullName={ $currentUser?.name || 'Пользователь' } />
                                        {/if}
                                        <label class="avatar-upload">
                                            Изменить аватар
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                style="display: none;" 
                                                on:change={ handleAvatarChange }
                                            />
                                        </label>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label for="mobile-name">Имя пользователя</label>
                                        <input 
                                            type="text" 
                                            id="mobile-name" 
                                            class="form-input" 
                                            bind:value={ editedName }
                                            placeholder="Введите имя"
                                        />
                                    </div>
                                    
                                    <div class="form-actions">
                                        <button class="btn btn-primary" on:click={ saveProfile } disabled={ isLoading }>
                                            { isLoading ? 'Сохранение...' : 'Сохранить' }
                                        </button>
                                        <button class="btn btn-secondary" on:click={ cancelEditing }>
                                            Отмена
                                        </button>
                                    </div>
                                </div>
                            {:else}
                                <div class="profile-info">
                                    <div class="info-item">
                                        <strong>Имя:</strong> { $currentUser?.name }
                                    </div>
                                    <div class="info-item">
                                        <strong>Email:</strong> { $currentUser?.email }
                                    </div>
                                    <div class="info-item">
                                        <strong>Роль:</strong> { userRole }
                                    </div>
                                    
                                    <button class="btn btn-primary" on:click={ startEditingProfile }>
                                        Редактировать профиль
                                    </button>
                                </div>
                            {/if}
                        </div>
                        
                        <!-- Мобильный блок статистики -->
                        <div class="profile-stats-mobile">
                            <h2>Моя статистика</h2>
                            <div class="stats-summary-mobile">
                                <div class="stat-item">
                                    <div class="stat-value">{stats.assignedToMe}</div>
                                    <div class="stat-label">Назначено мне</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-value">{stats.completedTickets}</div>
                                    <div class="stat-label">Завершено</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="active-tickets-section">
                            <div class="section-header">
                                <h2>Активные заявки</h2>
                                <a href="/tickets" class="view-all">Все</a>
                            </div>
                            
                            {#if activeTickets.length > 0}
                                <div class="tickets-list-mobile">
                                    {#each activeTickets.slice(0, 3) as ticket}
                                        <a href={`/tickets/${ticket.id}`} class="ticket-card-mobile">
                                            <div class="ticket-header">
                                                <span class="ticket-id">{ ticket.building.code }-{ ticket.id }</span>
                                                <span class={`status-badge ${ ticket.status }`}>
                                                    { ticket.status === 'new' ? 'Новая' : 'В работе' }
                                                </span>
                                            </div>
                                            <h3 class="ticket-title">{ ticket.title }</h3>
                                        </a>
                                    {/each}
                                </div>
                            {:else}
                                <div class="empty-state">
                                    <p>У вас нет активных заявок</p>
                                    <a href="/tickets/create" class="btn btn-primary">Создать заявку</a>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/if}
                
                {#if activeTab === Tab.TICKETS}
                    <div class="content-section">
                        <h1>Мои заявки</h1>
                        
                        {#if activeTickets.length > 0}
                            <div class="tickets-list-mobile">
                                {#each activeTickets as ticket}
                                    <a href={`/tickets/${ ticket.id }`} class="ticket-card-mobile">
                                        <div class="ticket-header">
                                            <span class="ticket-id">{ ticket.building.code }-{ ticket.id }</span>
                                            <span class={`status-badge ${ ticket.status }`}>
                                                { ticket.status === 'new' ? 'Новая' : 'В работе' }
                                            </span>
                                        </div>
                                        <h3 class="ticket-title">{ ticket.title }</h3>
                                        <div class="ticket-footer">
                                            <span class="ticket-date">
                                                { new Date(ticket.created_at).toLocaleDateString() }
                                            </span>
                                        </div>
                                    </a>
                                {/each}
                            </div>
                        {:else}
                            <div class="empty-state">
                                <p>У вас нет активных заявок</p>
                                <a href="/tickets/create" class="btn btn-primary">Создать заявку</a>
                            </div>
                        {/if}
                    </div>
                {/if}
                
                {#if activeTab === Tab.STATISTICS}
                    <div class="content-section">
                        <h1>Моя статистика</h1>
                        
                        <div class="stats-grid-mobile">
                            <div class="stat-card">
                                <div class="stat-value">{ stats.totalTickets }</div>
                                <div class="stat-label">Всего заявок</div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-value">{ stats.assignedToMe }</div>
                                <div class="stat-label">Назначено мне</div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-value">{ stats.completedTickets }</div>
                                <div class="stat-label">Завершено</div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-value">{ stats.cancelledTickets }</div>
                                <div class="stat-label">Отменено</div>
                            </div>
                        </div>
                    </div>
                {/if}
            {/if}
        </main>
    {/if}
</div>

<style>
    @import "./page.css";
</style>