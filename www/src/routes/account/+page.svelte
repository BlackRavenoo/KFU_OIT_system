<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { fade } from 'svelte/transition';
    
    import { currentUser, isAuthenticated } from '$lib/utils/auth/storage/initial';
    import { pageTitle, pageDescription } from '$lib/utils/setup/stores';
    import { notification, NotificationType } from '$lib/utils/notifications/notification';
    import { logout } from '$lib/utils/auth/api/api';
    import { getUserData } from '$lib/utils/auth/api/api';
    
    import Avatar from '$lib/components/Avatar/Avatar.svelte';
    import Profile from './components/Profile.svelte';
    
    const Tab = {
        PROFILE: 'profile',
        TICKETS: 'tickets',
        STATS: 'stats',
        USERS: 'users',
        BOTS: 'bots',
        TEA: 'tea'
    } as const;

    type Tab = typeof Tab[keyof typeof Tab];
    
    let activeTab: Tab = Tab.PROFILE;
    let isLoading: boolean = false;
    let userRole: string = '';
    let isMenuOpen: boolean = false;
    let isMobileView: boolean = false;
    
    let userData = {
        name: '',
        email: '',
        role: ''
    };
    
    let stats = {
        totalTickets: 0,
        assignedToMe: 0,
        completedTickets: 0,
        cancelledTickets: 0
    };
    
    let activeTickets: any[] = [];
    
    function setTab(tab: Tab) {
        activeTab = tab;
        isMobileView && toggleMenu();
    }

    function toggleMenu() {
        isMenuOpen = !isMenuOpen;
        document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    }
    
    function checkMobileView() {
        isMobileView = window.innerWidth < 900;
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
            const user = await getUserData();
            userData = {
                name: user.name,
                email: user.email,
                role: user.role
            };
            userRole = userData.role === "Admin" ? 'Администратор' : 'Пользователь';
        } catch (error) {
            notification('Ошибка загрузки данных пользователя', NotificationType.Error);
        } finally {
            isLoading = false;
        }
    }
    
    onMount(() => {
        pageTitle.set('Личный кабинет | Система управления заявками ЕИ КФУ');
        pageDescription.set('Управление личной учетной записью и просмотр статистики по заявкам.');
        
        loadUserData();
        checkMobileView();
        window.addEventListener('resize', checkMobileView);
    });

    onDestroy(() => {
        pageTitle.set('ОИТ | Система управления заявками ЕИ КФУ');
        pageDescription.set('Система обработки заявок Отдела Информационных Технологий Елабужского института Казанского Федерального Университета. Система позволяет создавать заявки на услуги ОИТ, отслеживать их статус, получать советы для самостоятельного решения проблемы и многое другое.');
        
        window.removeEventListener('resize', checkMobileView);
    });
</script>

<div class="account-page">
    {#if isMobileView}
        <div class="burger-container">
            <button 
                class="burger-button { isMenuOpen ? 'active' : '' }" 
                on:click={ toggleMenu }
                aria-label="Открыть/закрыть меню"
                aria-expanded={ isMenuOpen }
            >
                <span></span>
                <span></span>
                <span></span>
            </button>
        </div>
        
        {#if isMenuOpen}
            <button 
                class="menu-backdrop" 
                on:click={ toggleMenu } 
                transition:fade={{ duration: 200 }} 
                aria-label="Закрыть меню"
                type="button"
            ></button>
        {/if}
    {/if}
    
    <aside class="sidebar { isMobileView ? 'mobile' : '' } { isMenuOpen ? 'open' : '' }">
        <div class="user-profile">
            <Avatar width={ 80 } round={ true } userFullName={ $currentUser?.name || 'Пользователь' } />
            <h2>{ $currentUser?.name || 'Пользователь' }</h2>
            <span class="role-badge">{ userRole }</span>
        </div>
        
        <nav class="side-nav">
            <button 
                class={ activeTab === Tab.PROFILE ? 'active' : '' } 
                on:click={ () => setTab(Tab.PROFILE) }
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                Профиль
            </button>
            
            <button 
                class={ activeTab === Tab.TICKETS ? 'active' : '' } 
                on:click={ () => setTab(Tab.TICKETS) }
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Мои заявки
            </button>

            {#if $currentUser?.role === "Admin"}
                <button 
                    class={ activeTab === Tab.STATS? 'active' : '' } 
                    on:click={ () => setTab(Tab.STATS) }
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line><line x1="0" y1="20" x2="24" y2="20"></line></svg>
                    Статистика
                </button>
            
                <button 
                    class={ activeTab === Tab.USERS ? 'active' : '' } 
                    on:click={ () => setTab(Tab.USERS) }
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    Пользователи
                </button>
            
                <button 
                    class={ activeTab === Tab.BOTS ? 'active' : '' } 
                    on:click={ () => setTab(Tab.BOTS) }
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line><rect x="10" y="14" width="4" height="3"></rect></svg>
                    Боты
                </button>
            {/if}
        </nav>
        
        <button class="logout-btn" on:click={ handleLogout } aria-label="Выйти из системы">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Выйти
        </button>
    </aside>
    
    <div class="main-content {isMobileView ? 'mobile' : ''}" transition:fade={{ duration: 200 }}>
        {#if isLoading}
            <div class="loader">Загрузка...</div>
        {:else}
            {#if activeTab === Tab.PROFILE}
                <Profile 
                    { userData }
                    { stats }
                    { activeTickets }
                    on:reloadData={ loadUserData }
                />
            {:else}
                <div class="content-section">
                    <h1>Страница в разработке</h1>
                    <p>Этот раздел находится в стадии разработки.</p>
                </div>
            {/if}
        {/if}
    </div>
</div>

<style>
    @import "./page.css";
</style>