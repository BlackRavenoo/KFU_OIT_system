<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { fade } from 'svelte/transition';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { get } from 'svelte/store';
    
    import { currentUser, isAuthenticated } from '$lib/utils/auth/storage/initial';
    import { pageTitle, pageDescription } from '$lib/utils/setup/stores';
    import { notification, NotificationType } from '$lib/utils/notifications/notification';
    import { logout } from '$lib/utils/auth/api/api';
    import { authCheckComplete } from '$lib/utils/auth/api/api';
    import { Tab, type TabType, updateUrlParam, isValidTab } from '$lib/utils/account/tab-manager';
    import { UserRole } from '$lib/utils/auth/types';
    import { getAvatar } from '$lib/utils/account/avatar';
    import { handleAuthError } from '$lib/utils/api';
    
    import Profile from './components/Profile.svelte';
    import Tickets from './components/Tickets.svelte';
    import Statistics from './components/Statistic.svelte';
    import Users from './components/Users.svelte';
    import Bots from './components/Bots.svelte';
    import Request from './components/Request.svelte';
    import Buildings from './components/Buildings.svelte';
    import Departments from './components/Departments.svelte';
    
    let activeTab: TabType = Tab.PROFILE;
    let isLoading: boolean = false;
    let userRole: string = '';
    let isMenuOpen: boolean = false;
    let isMobileView: boolean = false;
    let avatarContainer: HTMLDivElement | null = null;
    
    let userData = {
        id: '',
        name: '',
        email: '',
        login: '',
        role: ''
    };
    
    let stats = {
        totalTickets: 0,
        assignedToMe: 0,
        completedTickets: 0,
        cancelledTickets: 0
    };
    
    let activeTickets: any[] = [];

    $: if (browser && $page.url.searchParams) {
        const tabParam = $page.url.searchParams.get('tab');
        if (tabParam) {
            if (isValidTab(tabParam))
                activeTab = tabParam;
            else
                updateUrlParam(Tab.PROFILE);
        } else {
            updateUrlParam(activeTab);
        }
    }
    
    $: if ($currentUser) {
        userData = $currentUser;
        userRole = $currentUser.role === UserRole.Administrator ? 'Администратор' :
            $currentUser.role === UserRole.Moderator ? 'Модератор' :
            $currentUser.role === UserRole.Programmer ? 'Сотрудник' :
            'Пользователь';
        
        avatarContainer && getAvatar($currentUser, avatarContainer, 80, true);
    }

    function setTab(tab: TabType) {
        activeTab = tab;
        updateUrlParam(tab);
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
    
    onMount(() => {
        pageTitle.set('Личный кабинет | Система управления заявками ЕИ КФУ');
        pageDescription.set('Управление личной учетной записью и просмотр статистики по заявкам.');

        if (!$isAuthenticated || $currentUser === null)
            handleAuthError(($page as any).url.pathname);
        else {
            checkMobileView();
            window.addEventListener('resize', checkMobileView);
        }
    });

    onDestroy(() => {
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
            <div bind:this={ avatarContainer } class="avatar-container"></div>
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
            
            {#if $currentUser?.role !== UserRole.Client }
            <button 
                class={ activeTab === Tab.TICKETS ? 'active' : '' } 
                on:click={ () => setTab(Tab.TICKETS) }
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Мои заявки
            </button>
            {/if}

            <button 
                class={ activeTab === Tab.REQUEST ? 'active' : '' } 
                on:click={ () => setTab(Tab.REQUEST) }
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                Создать заявку
            </button>

            <button 
                on:click={ () => goto('/page') }
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22"
                     viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="9" width="18" height="10" rx="2"></rect>
                    <path d="M8 9V5l4-2v6" />
                    <path d="M14 9V4l4 1v4" />
                </svg>
                Мои страницы
            </button>

            {#if $currentUser?.role === UserRole.Administrator || $currentUser?.role === UserRole.Moderator}
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
                {#if $currentUser?.role === UserRole.Administrator}
                    <button
                        class={ activeTab === (('buildings') as any) ? 'active' : '' }
                        on:click={ () => { activeTab = ('buildings' as any); updateUrlParam(('buildings') as any); isMobileView && toggleMenu(); } }
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                        Здания
                    </button>
                    <button
                        class={ activeTab === (('departments') as any) ? 'active' : '' }
                        on:click={ () => { activeTab = ('departments' as any); updateUrlParam(('departments') as any); isMobileView && toggleMenu(); } }
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect></svg>
                        Отделы
                    </button>
                    <button
                        class={ activeTab === Tab.BOTS ? 'active' : '' } 
                        on:click={ () => setTab(Tab.BOTS) }
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line><rect x="10" y="14" width="4" height="3"></rect></svg>
                        Боты
                    </button>
                {/if}
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
                />
            {:else if activeTab === Tab.TICKETS}
                <Tickets />
            {:else if activeTab === Tab.STATS}
                <Statistics />
            {:else if activeTab === Tab.USERS}
                <Users />
            {:else if activeTab === Tab.BUILDINGS}
                <Buildings />
            {:else if activeTab === Tab.DEPARTMENTS}
                <Departments />
            {:else if activeTab === Tab.BOTS}
                <Bots />
            {:else if activeTab === Tab.REQUEST}
                <Request />
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