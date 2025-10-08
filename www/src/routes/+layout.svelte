<script lang="ts">
    import '../assets/app.css';
    
    import { onMount } from 'svelte';
    import { afterNavigate } from '$app/navigation';
    import { page } from '$app/stores';

    import { checkAuthentication, authCheckComplete } from '$lib/utils/auth/api/api';

    import Footer from '$lib/components/Footer/Footer.svelte';
    import Nav from '$lib/components/Nav/Nav.svelte';
    
    let isDarkTheme = false;
    let showThemeButton = false;
    let isHomePage = false;
    let isScrolled = false;
    let isButtonVisible = false;
    let buttonHideTimeout: ReturnType<typeof setTimeout> | null = null;

    const pagesWithFooter = ['/', '/contact', '/faq', '/privacy'];
    
    $: showFooter = pagesWithFooter.some(path => $page.url.pathname === path);
    $: isHomePage = $page.url.pathname === '/';
    $: isButtonVisible = (isHomePage && !isScrolled) || showThemeButton;

    /**
     * Переключение темы оформления
     * Меняет значение isDarkTheme и обновляет класс на элементе <html>
     * для применения соответствующих стилей
     */
    function toggleTheme() {
        isDarkTheme = !isDarkTheme;
        document.documentElement.classList.toggle('dark', isDarkTheme);
        localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
    }
    
    /**
     * Отслеживает прокрутку страницы и скрывает/показывает кнопку смены темы
     */
    function handleScroll() {
        isScrolled = window.scrollY > 10;
    }

    /**
     * Показывает кнопку смены темы при нажатии или наведении на область
     */
    function showButton() {
        if (buttonHideTimeout) {
            clearTimeout(buttonHideTimeout);
            buttonHideTimeout = null;
        }
        
        showThemeButton = true;
        
        buttonHideTimeout = setTimeout(() => {
            showThemeButton = false;
        }, 3000);
    }
    
    onMount(() => {
        checkAuthentication();

        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark' || savedTheme === 'light')
            isDarkTheme = savedTheme === 'dark';
        else
            isDarkTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dark', isDarkTheme);
        
        window.addEventListener('scroll', handleScroll);
        handleScroll();
        
        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (buttonHideTimeout) clearTimeout(buttonHideTimeout);
        };
    });

    afterNavigate(() => {
        document.body.classList.remove('page-transitioning');
        handleScroll();
    });

    function handleTransitionStart() {
        document.body.classList.add('page-transitioning');
    }
</script>

{#if $authCheckComplete}
    <div class="container" on:outrostart={handleTransitionStart}>
        <Nav />
        <slot></slot>
        {#if showFooter}
            <Footer />
        {/if}
    </div>
{:else}
    <div class="loading-container">
        <div class="loader"></div>
    </div>
{/if}

<div 
    class="theme-toggle-trigger"
    on:click={ showButton }
    on:mouseenter={ showButton }
    aria-hidden="true"
></div>

<button 
    class="theme-toggle-btn" 
    on:click={ toggleTheme } 
    aria-label="Сменить тему"
    class:visible={ isButtonVisible }
>
    {#if isDarkTheme}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79z" fill="rgba(0, 0, 0, 0.87)"/>
        </svg>
        <span>В день</span>
    {:else}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="5" fill="rgba(255, 255, 255, 0.87)"/>
            <g stroke="rgba(255, 255, 255, 0.87)" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </g>
        </svg>
        <span>В ночь</span>
    {/if}
</button>

<style>
    :global(body.page-transitioning .nav-auth-elements) {
        visibility: hidden;
    }
    
    .loading-container {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        width: 100vw;
    }
    
    .loader {
        width: 48px;
        height: 48px;
        border: 5px solid #BAD2E6;
        border-radius: 50%;
        border-top-color: #075CEF;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .theme-toggle-btn {
        position: fixed;
        bottom: -4rem;
        right: 1rem;
        background-color: var(--dark);
        padding: .5rem 1rem;
        color: var(--light-gray);
        font-weight: 400;
        border: none;
        cursor: pointer;
        margin-top: 0;
        box-shadow: none !important;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out, color 0.2s ease;
        z-index: 1000;
    }

    .theme-toggle-btn:hover {
        transform: translateY(-5rem) scale(1.05) !important;
    }

    .theme-toggle-btn span {
        margin-left: .5rem;
    }

    .theme-toggle-btn.visible {
        transform: translateY(-5rem);
        opacity: 1;
        pointer-events: all;
    }

    .theme-toggle-btn svg {
        vertical-align: middle;
    }

    .theme-toggle-trigger {
        position: fixed;
        bottom: 0;
        right: 0;
        width: 4rem;
        height: 4rem;
        z-index: 999;
        cursor: pointer;
        background: transparent;
    }
</style>