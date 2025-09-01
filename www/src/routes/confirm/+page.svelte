<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import { fly } from 'svelte/transition';

    import { isAuthenticated } from '$lib/utils/auth/storage/initial';
    import { pageTitle } from '$lib/utils/setup/stores';
    import { navigateToError } from '$lib/utils/error';
    import { notification, NotificationType } from '$lib/utils/notifications/notification';
    
    let token: string | null = null;
    let loading: boolean = true;
    let fullName: string = '';
    let password: string = '';
    let confirmPassword: string = '';
    let passwordVisible: boolean = false;
    let confirmPasswordVisible: boolean = false;
    let isSubmitting: boolean = false;
    
    let nameErrors: string[] = [];
    let passwordErrors: string[] = [];
    let confirmPasswordErrors: string[] = [];
    
    /**
     * Валидация имени - должно быть не менее 2 символов
     */
    function validateName(name: string): string[] {
        const errors = [];
        if (!name.trim())
            errors.push('Имя не может быть пустым');
        else if (name.trim().length < 2)
            errors.push('Имя должно содержать не менее 2 символов');
        return errors;
    }
    
    /**
     * Валидация пароля - минимум 8 символов, заглавные, строчные и цифры
     */
    function validatePassword(password: string): string[] {
        const errors = [];
        
        if (!password) {
            errors.push('Пароль не может быть пустым');
            return errors;
        }
        
        if (password.length < 8)
            errors.push('Пароль должен содержать не менее 8 символов');
        if (!/[A-Z]/.test(password))
            errors.push('Пароль должен содержать хотя бы одну заглавную букву');
        if (!/[a-z]/.test(password))
            errors.push('Пароль должен содержать хотя бы одну строчную букву');
        if (!/[0-9]/.test(password))
            errors.push('Пароль должен содержать хотя бы одну цифру');
        
        return errors;
    }
    
    /**
     * Валидация совпадения паролей
     */
    function validatePasswordMatch(password: string, confirmPassword: string): string[] {
        const errors = [];
        
        if (password !== confirmPassword)
            errors.push('Пароли не совпадают');
        
        return errors;
    }
    
    /**
     * Обработка валидации при вводе
     */
    $: {
        nameErrors = validateName(fullName);
        passwordErrors = validatePassword(password);
        confirmPasswordErrors = validatePasswordMatch(password, confirmPassword);
    }
    
    /**
     * Обработчик отправки формы
     */
    async function handleSubmit() {
        if (nameErrors.length > 0 || passwordErrors.length > 0 || confirmPasswordErrors.length > 0) return;
        
        isSubmitting = true;
        
        try {
            // !!! TDD !!!
            
        } catch (err: any) {
            notification('Ошибка при подтверждении регистрации', NotificationType.Error);
        } finally {
            isSubmitting = false;
        }
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
        pageTitle.set('Подтверждение регистрации | Система управления заявками ЕИ КФУ');

        try {
            $isAuthenticated && navigateToError(403);
        } catch (error) { }

        if (browser && $page.url.searchParams) {
            token = $page.url.searchParams.get('token');

            if (!token) {
                navigateToError(404);
                return;
            }
        } else {
            if (browser) {
                navigateToError(404);
                return;
            }
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
                <h1>Завершение <span class="gradient-text">регистрации</span></h1>
                <p class="hero-description">Для завершения регистрации вашей учетной записи, заполните форму ниже.</p>
                
                {#if !loading}
                    <div class="reset-password-card" id="form" in:fly={{ y: 30, duration: 800, delay: 600 }}>
                        <form on:submit|preventDefault={ handleSubmit } class="reset-form">
                            <div class="form-group">
                                <label for="fullName">Ваше имя</label>
                                <input 
                                    type="text" 
                                    id="fullName" 
                                    bind:value={ fullName }
                                    placeholder="Введите ваше полное имя"
                                    class={ nameErrors.length > 0 ? "error" : "" }
                                    autocomplete="name"
                                />
                                {#if nameErrors.length > 0}
                                    <ul class="error-list">
                                        {#each nameErrors as error}
                                            <li>{ error }</li>
                                        {/each}
                                    </ul>
                                {/if}
                            </div>
                            
                            <div class="form-group">
                                <label for="password">Пароль</label>
                                <div class="password-input-container">
                                    <input 
                                        type={ passwordVisible ? "text" : "password" } 
                                        id="password" 
                                        bind:value={ password }
                                        placeholder="Введите пароль"
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
                                        placeholder="Подтвердите пароль"
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
                                    disabled={ isSubmitting || nameErrors.length > 0 || passwordErrors.length > 0 || confirmPasswordErrors.length > 0 }
                                >
                                    {#if isSubmitting}
                                        <div class="spinner-small"></div>
                                        Отправка...
                                    {:else}
                                        Завершить регистрацию
                                    {/if}
                                </button>
                            </div>
                            
                            <div class="form-footer">
                                <a href="/" class="login-link">Вернуться на главную</a>
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
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="180" height="180">
                        <path fill="currentColor" d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"/>
                    </svg>
                </div>
                <div class="floating-animation lock-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="150" height="150" transform="scale(1.25)">
                        <path fill="currentColor" d="M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V160H256c-17.7 0-32-14.3-32-32V0H64zM256 0V128H384L256 0z"/>
                        <g fill="white" stroke="white" stroke-width="8">
                            <path d="M100 210l12 12 24-24" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                            <line x1="150" y1="210" x2="280" y2="210" stroke-width="6" stroke-linecap="round"/>
                            <path d="M100 260l12 12 24-24" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                            <line x1="150" y1="260" x2="280" y2="260" stroke-width="6" stroke-linecap="round"/>
                            <path d="M100 310l12 12 24-24" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                            <line x1="150" y1="310" x2="280" y2="310" stroke-width="6" stroke-linecap="round"/>
                            <path d="M100 360l12 12 24-24" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                            <line x1="150" y1="360" x2="280" y2="360" stroke-width="6" stroke-linecap="round"/>
                            <path d="M100 410l12 12 24-24" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                            <line x1="150" y1="410" x2="280" y2="410" stroke-width="6" stroke-linecap="round"/>
                        </g>
                    </svg>
                </div>
            </div>
        </div>
    </div>
</header>

<style>
    @import '../reset/page.css';
    @import './page.css';
</style>