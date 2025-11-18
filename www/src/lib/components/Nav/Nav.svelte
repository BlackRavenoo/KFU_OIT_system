<!--
--- @file Nav.svelte
--- Компонент навигационной панели
--- Встраивается в +layout.svelte
-->

<script lang="ts">
    import KFU_large from '../../../assets/temp_logo.png';
    import KFU from '../../../assets/temp_logo(1).webp';

    import { login, getUserData } from '$lib/utils/auth/api/api';
    import { currentUser, isAuthenticated } from '$lib/utils/auth/storage/initial';
    import { pageTitle, pageDescription } from '$lib/utils/setup/stores';
    import { navigateToForm, navigateToHome } from '$lib/utils/setup/navigate';
    import { formatName } from '$lib/utils/validation/validate';

    import Modal from './Modal.svelte';
    import { UserRole } from '$lib/utils/auth/types';

    import { page } from '$app/stores';
    import { goto } from '$app/navigation';

    let isShowModal: boolean = false;
    let modalElement: HTMLElement;
    let captchaComponent: any;
    let loginError: string = '';
    
    let username: string = '';
    let userLogin: string = '';
    let userPassword: string = '';
    let userEmail: string = '';
    let rememberMe: boolean = false;

    let redirectAfterLogin: string | null = null;

    /**
     * Нормализует параметр route из URL
     * Проверяет, что путь является внутренним и безопасным для редиректа
     * @param val - значение параметра route из URL
     * @returns нормализованный путь или null
     */
    function normalizeRouteParam(val: string | null): string | null {
        if (!val) return null;
        try {
            const base = typeof window !== 'undefined' ? window.location.origin : 'https://local';
            const url = new URL(val, base);
            if (typeof window !== 'undefined' && url.origin !== window.location.origin) return '/';
            const target = `${url.pathname}${url.search}${url.hash}`;
            return target || '/';
        } catch {
            return null;
        }
    }

    $: {
        const u = $page?.url;
        if (!u) {
            // нет URL — ничего не делаем
        } else {
            const action = u.searchParams.get('action');
            const route = u.searchParams.get('route');
            if (action === 'login' && !$isAuthenticated) {
                isShowModal = true;
                redirectAfterLogin = normalizeRouteParam(route);
            }
        }
    }

    /**
     * Обработчик входа в систему
     * Проверяет введенные данные пользователя и выполняет вход
     * Если вход успешен, обновляет состояние пользователя и закрывает модальное окно
     */
    async function loginHandler() {
        loginError = '';
        if (!userLogin || !userPassword) return;

        if (captchaComponent && typeof captchaComponent.validate === 'function') {
            const captchaToken = await captchaComponent.validate();
            if (!captchaToken) {
                loginError = 'Проверка капчи не пройдена.';
                return;
            } else {
                console.log('Captcha token:', captchaToken);
            }
        }

        try {
            const userData = await login(userLogin, userPassword, rememberMe);

            if (userData && !userData.error) {
                const user = await getUserData();
                if (user) {
                    $currentUser = user;
                    $isAuthenticated = true;
                    isShowModal = false;
                }
                userLogin = '';
                userPassword = '';

                if (redirectAfterLogin) {
                    const target = redirectAfterLogin;
                    redirectAfterLogin = null;
                    goto(target, { replaceState: true });
                }
            } else {
                loginError = userData?.message || 'Неверный логин или пароль.';
            }
        } catch (error) {
            loginError = 'Неверный логин или пароль.';
        }
    }

    /**
     * Обработчик сброса пароля
     * Подтверждение сброса происходит через письмо на почту
     */
    async function resetPasswordHandler() {
        // !!! TDD !!!
    }

    /**
     * Обработчик навигации к форме входа
     * Устанавливает флаг для отображения модального окна входа
     * Вызывается при клике на кнопку "Войти"
     */
    function navLoginHandler() {
        isShowModal = true;
    }

    /**
     * Обработчик обновления данных в модальном окне
     * Обновляет локальные переменные при изменении данных в модальном окне
     * @param event
     */
    function handleModalUpdate(event: CustomEvent<{ userLogin?: string; userPassword?: string; rememberMe?: boolean }>) {
        if ('userLogin' in event.detail) userLogin = event.detail.userLogin ?? '';
        if ('userPassword' in event.detail) userPassword = event.detail.userPassword ?? '';
        if ('rememberMe' in event.detail) rememberMe = event.detail.rememberMe ?? false;
    }

    /**
     * Обработчик закрытия модального окна
     * Сбрасывает флаг отображения модального окна и удаляет обработчик клавиатуры
     */
    function handleModalClose() {
        isShowModal = false;
    }
</script>

<svelte:head>
    <title>{ $pageTitle }</title>
    <meta name="description" content={ $pageDescription }>
</svelte:head>

<nav>
    <div
        class="logo"
        role="button"
        tabindex="0"
        aria-label="На главную"
        on:click={ navigateToHome }
        on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigateToHome; }}
    >
        <img src="{ KFU_large }" alt="Logo" class="large-logo" />
        <img src="{ KFU }" alt="Logo Small" class="small-logo" />
    </div>
    <ul>
        <li><a href="/" class="big nav-link">Главная</a></li>
        {#if $isAuthenticated && $currentUser?.role !== UserRole.Client}
            <li><a href="/ticket" class="nav-link">Заявки</a></li>
        {:else if $currentUser?.role !== UserRole.Client}
            <li><a href="/#form" class="nav-link" id="form-link" on:click={ navigateToForm }>Оставить заявку</a></li>
        {:else}
            <li><a href="/account?tab=request" class="nav-link">Заявка</a></li>
        {/if}
        <li><a href="/contact" class="big nav-link">Контакты</a></li>
        {#if $isAuthenticated}
            <li>
                <a href="/account" class="account">
                    <span class="account-avatar">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512l388.6 0c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304l-91.4 0z"/></svg>
                    </span>
                    <span class="account-name">{ formatName($currentUser?.name || '') }</span>
                </a>
            </li>
        {:else}
            <li><button class="login-btn" on:click={ navLoginHandler }>Войти</button></li>
        {/if}
    </ul>
</nav>

{#if isShowModal && !$isAuthenticated}
    <Modal
        bind:modalElement
        bind:captchaComponent
        on:login={ loginHandler }
        on:reset={ resetPasswordHandler }
        on:update={ handleModalUpdate }
        on:close={ handleModalClose }
        userLogin={ userLogin }
        userPassword={ userPassword }
        userEmail={ userEmail }
        rememberMe={ rememberMe }
        loginError={ loginError }
    />
{/if}

<style scoped>
    @import './Nav.css';
</style>