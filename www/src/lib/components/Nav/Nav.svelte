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
    import { formatName } from '$lib/utils/setup/validate';

    import Modal from './Modal.svelte';

    let isAdmin: boolean = false;

    let isShowModal: boolean = false;
    let modalElement: HTMLElement;
    let captchaComponent: any;
    let loginError: string = '';
    
    let username: string = '';
    let userLogin: string = '';
    let userPassword: string = '';
    let userEmail: string = '';
    let rememberMe: boolean = false;

    /**
     * Начальное состояние авторизации
     * Используется для восстановления состояния при загрузке страницы
    */
    $: {
        if ($currentUser) {
            username = $currentUser.name || '';
            isAdmin = $currentUser.role === "Admin";
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
        {#if $isAuthenticated}
            <li><a href="/tickets" class="nav-link">Заявки</a></li>
        {:else}
            <li><a href="/#form" class="nav-link" id="form-link" on:click={ navigateToForm }>Оставить заявку</a></li>
        {/if}
        <li><a href="/contact" class="big nav-link">Контакты</a></li>
        {#if $isAuthenticated}
            <li>
                <a href="/account" class="account">
                    <span class="account-avatar">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512l388.6 0c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304l-91.4 0z"/></svg>
                    </span>
                    <span class="account-name">{ formatName(username) }</span>
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