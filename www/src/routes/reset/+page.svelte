<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { error } from '@sveltejs/kit';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import { isAuthenticated } from '$lib/utils/auth/storage/initial';
    import { pageTitle } from '$lib/utils/setup/stores';
    import { notification, NotificationType } from '$lib/utils/notifications/notification';
    import { fly } from 'svelte/transition';
    
    let token: string | null = null;
    let loading: boolean = true;
    let newPassword: string = '';
    let confirmPassword: string = '';
    let passwordVisible: boolean = false;
    let confirmPasswordVisible: boolean = false;
    let isSubmitting: boolean = false;
    
    let passwordErrors: string[] = [];
    let confirmPasswordErrors: string[] = [];
    
    function validatePassword(password: string): string[] {
        // !!! TDD !!!
        return [];
    }
    
    function validatePasswordMatch(password: string, confirmPassword: string): string[] {
        // !!! TDD !!!
        return [];
    }
    
    async function handleSubmit() {
        // !!! TDD !!!
    }
    
    /**
     * Переключение видимости пароля
     */
    function togglePasswordVisibility() {
        passwordVisible = !passwordVisible;
    }

    /**
     * Переключение видимости подтверждения пароля
     */
    function toggleConfirmPasswordVisibility() {
        confirmPasswordVisible = !confirmPasswordVisible;
    }

    /**
     * Инициализация страницы
     * Установка заголовка страницы и проверка авторизации пользователя
     */
    onMount(() => {
    // TDD: fix error handling
        pageTitle.set('Сброс пароля | Система управления заявками ЕИ КФУ');

        try {
            if ($isAuthenticated)
                throw error(403, { code: 'FORBIDDEN', message: 'Доступ запрещён: вы уже авторизованы' });

        } catch (error) { }

        if (browser && $page.url.searchParams) {
            token = $page.url.searchParams.get('token');

            if (!token)
                throw error(403, { code: 'FORBIDDEN', message: 'Доступ запрещён: отсутствует токен сброса пароля' });
        }

        loading = false;
    });
    
    /**
     * Сброс заголовка страницы при уничтожении компонента
    */
    onDestroy(() => {
        pageTitle.set('ОИТ | Система управления заявками ЕИ КФУ');
    });
</script>

<header>
    <div class="header_content" id="hero">
        <div class="hero-container" in:fly={{ y: 30, duration: 800, delay: 300 }}>
            <div class="hero-form">
                <h1>Сброс <span class="gradient-text">пароля</span></h1>
                <p class="hero-description">Для установки нового пароля вашей учетной записи, заполните форму ниже.</p>
                
                {#if !loading}
                    <div class="reset-password-card" id="form" in:fly={{ y: 30, duration: 800, delay: 600 }}>
                        <form on:submit|preventDefault={ handleSubmit } class="reset-form">
                            <div class="form-group">
                                <label for="password">Новый пароль</label>
                                <div class="password-input-container">
                                    <input 
                                        type={ passwordVisible ? "text" : "password" } 
                                        id="password" 
                                        bind:value={ newPassword }
                                        placeholder="Введите новый пароль"
                                        class={ passwordErrors.length > 0 ? "error" : "" }
                                        autocomplete="new-password"
                                    />
                                    <button 
                                        type="button" 
                                        class="toggle-password" 
                                        on:click={ togglePasswordVisibility }
                                        title={ passwordVisible ? "Скрыть пароль" : "Показать пароль" }
                                    >
                                        {#if passwordVisible}
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" width="20" height="20">
                                                <path fill="currentColor" d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c8.4-19.3 10.6-41.4 4.8-63.3c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zM373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5L373 389.9z"/>
                                            </svg>
                                        {:else}
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="20" height="20">
                                                <path fill="currentColor" d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/>
                                            </svg>
                                        {/if}
                                    </button>
                                </div>
                                {#if passwordErrors.length > 0}
                                    <ul class="error-list">
                                        {#each passwordErrors as error}
                                            <li>{ error }</li>
                                        {/each}
                                    </ul>
                                {/if}
                            </div>
                            
                            <div class="form-group">
                                <label for="confirmPassword">Подтверждение пароля</label>
                                <div class="password-input-container">
                                    <input 
                                        type={ confirmPasswordVisible ? "text" : "password" } 
                                        id="confirmPassword" 
                                        bind:value={ confirmPassword }
                                        placeholder="Подтвердите новый пароль"
                                        class={ confirmPasswordErrors.length > 0 ? "error" : "" }
                                        autocomplete="new-password"
                                    />
                                    <button 
                                        type="button" 
                                        class="toggle-password" 
                                        on:click={ toggleConfirmPasswordVisibility }
                                        title={ confirmPasswordVisible ? "Скрыть пароль" : "Показать пароль" }
                                    >
                                        {#if confirmPasswordVisible}
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" width="20" height="20">
                                                <path fill="currentColor" d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c8.4-19.3 10.6-41.4 4.8-63.3c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zM373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5L373 389.9z"/>
                                            </svg>
                                        {:else}
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width="20" height="20">
                                                <path fill="currentColor" d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/>
                                            </svg>
                                        {/if}
                                    </button>
                                </div>
                                {#if confirmPasswordErrors.length > 0}
                                    <ul class="error-list">
                                        {#each confirmPasswordErrors as error}
                                            <li>{ error }</li>
                                        {/each}
                                    </ul>
                                {/if}
                            </div>
                            
                            <div class="form-actions">
                                <button 
                                    type="submit" 
                                    class="submit-button pulse-animation"
                                    disabled={  isSubmitting || passwordErrors.length > 0 || confirmPasswordErrors.length > 0 }
                                >
                                    {#if isSubmitting}
                                        <div class="spinner-small"></div>
                                        Отправка...
                                    {:else}
                                        Сменить пароль
                                    {/if}
                                </button>
                            </div>
                            
                            <div class="form-footer">
                                <a href="/login" class="login-link">Вернуться на страницу входа</a>
                            </div>
                        </form>
                    </div>
                {:else if loading}
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <p>Загрузка...</p>
                    </div>
                {/if}
            </div>
            
            <div class="hero-visual">
                <div class="floating-animation-slow key-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="180" height="180">
                        <path fill="currentColor" d="M336 352c97.2 0 176-78.8 176-176S433.2 0 336 0S160 78.8 160 176c0 18.7 2.9 36.8 8.3 53.7L7 391c-4.5 4.5-7 10.6-7 17v80c0 13.3 10.7 24 24 24h80c13.3 0 24-10.7 24-24V448h40c13.3 0 24-10.7 24-24V384h40c6.4 0 12.5-2.5 17-7l33.3-33.3c16.9 5.4 35 8.3 53.7 8.3zM376 96a40 40 0 1 1 0 80 40 40 0 1 1 0-80z"/>
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
    @import './page.css'
</style>