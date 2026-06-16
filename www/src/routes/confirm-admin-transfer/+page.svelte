<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import { fly } from 'svelte/transition';

    import { pageTitle } from '$lib/utils/setup/stores';
    import { navigateToError } from '$lib/utils/error';
    import { validateAdminTransferToken, confirmAdminTransfer } from '$lib/utils/admin/admin-transfer';
    import { loadUsersData } from '$lib/utils/admin/users';
    import { currentUser } from '$lib/utils/auth/storage/initial';
    import { UserRole } from '$lib/utils/auth/types';

    let token: string | null = null;
    let loading: boolean = true;
    let isSubmitting: boolean = false;
    let confirmed: boolean = false;
    let wrongUser: boolean = false;

    let fromUserName: string = '';
    let toUserName: string = '';

    /**
     * Обработчик подтверждения передачи прав администратора
     * @returns {Promise<void>}
     */
    async function handleConfirm() {
        if (!token) return;
        isSubmitting = true;
        const success = await confirmAdminTransfer(token);
        if (success) {
            confirmed = true;
            setTimeout(() => {
                window.location.href = '/account';
            }, 2500);
        }
        isSubmitting = false;
    }

    /**
     * При монтировании компонента проверяем токен из URL, загружаем данные о передаче прав и отображаем информацию пользователю.
    */
    onMount(async () => {
        pageTitle.set('Подтверждение передачи прав | Система управления заявками ЕИ КФУ');

        if (!browser) return;

        token = $page.url.searchParams.get('token');
        if (!token) {
            navigateToError(404);
            return;
        }

        const data = await validateAdminTransferToken(token);
        if (!data) {
            navigateToError(404);
            return;
        }

        if ($currentUser && String($currentUser.id) !== String(data.to_user_id)) {
            wrongUser = true;
            loading = false;
            return;
        }

        toUserName = $currentUser?.name ?? `ID: ${data.to_user_id}`;

        const adminResult = await loadUsersData(1, 10, '', UserRole.Administrator);
        const fromUser = adminResult.users.find(u => String(u.id) === String(data.from_user_id));
        fromUserName = fromUser?.name ?? `ID: ${data.from_user_id}`;

        loading = false;
    });

    /**
     * При размонтировании компонента сбрасываем заголовок страницы к стандартному значению.
    */
    onDestroy(() => {
        pageTitle.set('Service Desk | Система управления заявками ЕИ КФУ');
    });
</script>

<header>
    <div class="header_content" id="hero">
        <div class="hero-container" in:fly={{ y: 30, duration: 800, delay: 300 }}>
            <div class="hero-form">
                <h1>Передача прав <span class="gradient-text">администратора</span></h1>
                <p class="hero-description">
                    Вам предлагается принять права администратора системы управления заявками.
                    После подтверждения текущий администратор станет модератором.
                </p>

                {#if loading}
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <p>Проверка токена...</p>
                    </div>
                {:else if wrongUser}
                    <div class="confirm-card" in:fly={{ y: 30, duration: 800 }}>
                        <div class="warning-block">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/>
                                <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            <span>Это приглашение предназначено для другого аккаунта. Войдите в нужный аккаунт и перейдите по ссылке снова.</span>
                        </div>
                        <div class="form-footer">
                            <a href="/" class="login-link">Вернуться на главную</a>
                        </div>
                    </div>
                {:else if confirmed}
                    <div class="confirm-card" in:fly={{ y: 30, duration: 800 }}>
                        <div class="success-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                        </div>
                        <p class="success-text">Права успешно переданы. Перенаправление в личный кабинет...</p>
                    </div>
                {:else}
                    <div class="confirm-card" in:fly={{ y: 30, duration: 800, delay: 600 }}>
                        <div class="warning-block">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/>
                                <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            <span>Это действие необратимо. Текущий администратор потеряет свою роль.</span>
                        </div>

                        <div class="transfer-info">
                            <div class="transfer-row">
                                <span class="transfer-label">От пользователя</span>
                                <span class="transfer-value">{ fromUserName }</span>
                            </div>
                            <div class="transfer-arrow">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"/>
                                    <polyline points="19 12 12 19 5 12"/>
                                </svg>
                            </div>
                            <div class="transfer-row">
                                <span class="transfer-label">Кому</span>
                                <span class="transfer-value">{ toUserName }</span>
                            </div>
                            <div class="transfer-arrow">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19"/>
                                    <polyline points="19 12 12 19 5 12"/>
                                </svg>
                            </div>
                            <div class="transfer-row">
                                <span class="transfer-label">Новая роль</span>
                                <span class="transfer-value role-badge">Администратор</span>
                            </div>
                        </div>

                        <div class="form-actions">
                            <button
                                class="submit-button pulse-animation"
                                on:click={ handleConfirm }
                                disabled={ isSubmitting }
                            >
                                {#if isSubmitting}
                                    <div class="spinner-small"></div>
                                    Подтверждение...
                                {:else}
                                    Принять права администратора
                                {/if}
                            </button>
                        </div>

                        <div class="form-footer">
                            <a href="/" class="login-link">Отклонить и вернуться на главную</a>
                        </div>
                    </div>
                {/if}
            </div>

            <div class="hero-visual">
                <div class="floating-animation-slow key-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" width="180" height="180">
                        <path fill="currentColor" d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"/>
                    </svg>
                </div>
                <div class="floating-animation lock-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="150" height="150">
                        <path fill="currentColor" d="M144 144v48H304V144c0-44.2-35.8-80-80-80s-80 35.8-80 80zM80 192V144C80 64.5 144.5 0 224 0s144 64.5 144 144v48h16c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V256c0-35.3 28.7-64 64-64H80z"/>
                    </svg>
                </div>
            </div>
        </div>
    </div>
</header>

<style>
    @import './page.css';
</style>
