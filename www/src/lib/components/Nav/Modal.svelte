<script lang="ts">
    import KFU from '../../../assets/KFU.webp';

    import { fade, scale } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { createEventDispatcher } from 'svelte';
    import { onMount, onDestroy } from 'svelte';

    import { handleModalKeydown } from '$lib/utils/notifications/modal';

    export let userLogin: string;
    export let userPassword: string;
    export let userEmail: string;
    export let rememberMe: boolean;
    export let loginError: string;
    export let modalElement: HTMLElement;

    const dispatch = createEventDispatcher();

    let isClosing: boolean = false;
    let isReseting: boolean = false;

    /**
     * Обработчик нажатия клавиш в модальном окне
     * Закрывает модальное окно при нажатии Escape
    */
    function handleKeydown(event: KeyboardEvent) {
        const result = handleModalKeydown(event, modalElement);
        if (!result) dispatch('close');
    }

    onMount(() => {
        window.addEventListener('keydown', handleKeydown);
    });

    onDestroy(() => {
        window.removeEventListener('keydown', handleKeydown);
    });
</script>

<div class="modal-overlay"
        on:click={ () => { dispatch('close') } }
        transition:fade={{ duration: 200 }}
        role="presentation">
    <div class="modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-content"
        on:click|stopPropagation
        on:keydown={ handleKeydown }
        in:scale={{ start: 0.8, duration: 300, delay: 100 }}
        out:scale={{ start: 0.8, duration: 200 }}
        tabindex="-1"
        bind:this={ modalElement }>
        <div class="modal" class:closing={ isClosing } transition:scale={{ duration: 300, start: 0.95, opacity: 0, easing: cubicOut }}>
            <button class="modal-close" on:click={ () => { dispatch('close') } } aria-label="Закрыть окно">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                    <path fill="none" d="M0 0h24v24H0z"/>
                    <path d="M12 10.586l4.95-4.95 1.414 1.414-4.95 4.95 4.95 4.95-1.414 1.414-4.95-4.95-4.95 4.95-1.414-1.414 4.95-4.95-4.95-4.95L7.05 5.636z" fill="currentColor"/>
                </svg>
            </button>
            
            <div class="modal-content">
                <div class="modal-header">
                    <div class="logo-container">
                        <img src="{ KFU }" alt="KFU logo">
                    </div>
                    <h2>{ isReseting ? "Восстановление пароля" : "Авторизация" }</h2>
                </div>
                
                <div class="warning-message">
                    <div class="warning-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24l0 112c0 13.3-10.7 24-24 24s-24-10.7-24-24l0-112c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"/></svg>
                    </div>
                    <div class="warning-text">
                        <span>Внимание!</span>
                        <p>Вход в систему доступен только для сотрудников ОИТ</p>
                    </div>
                </div>
                
                {#if loginError}
                    <div class="login-error">{ loginError }</div>
                {/if}
                
                {#if !isReseting}
                    <form on:submit|preventDefault={ () => {
                        dispatch('login', { login: userLogin, password: userPassword, remember: rememberMe })
                    } }>
                        <div class="form-group">
                            <div class="input-container">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" class="input-icon"><path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512l388.6 0c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304l-91.4 0z"/></svg>
                                <input type="text" id="username" bind:value={ userLogin } on:input={ (e: Event) => {
                                    dispatch('update', { userLogin: ((e.target) as HTMLInputElement).value })
                                } } placeholder="Введите ваш логин" required />
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <div class="input-container">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" class="input-icon"><path d="M144 144v48H304V144c0-44.2-35.8-80-80-80s-80 35.8-80 80zM80 192V144C80 64.5 144.5 0 224 0s144 64.5 144 144v48h16c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V256c0-35.3 28.7-64 64-64H80z"/></svg>
                                <input type="password" id="password" bind:value={ userPassword } on:input={ (e: Event) => {
                                    dispatch('update', { userPassword: ((e.target) as HTMLInputElement).value })
                                } } placeholder="Введите ваш пароль" required />
                            </div>
                        </div>
                        
                        <div class="remember-container">
                            <label class="remember-label">
                                <input type="checkbox" bind:checked={ rememberMe } on:change={ (e: Event) => {
                                    dispatch('update', { rememberMe: ((e.target) as HTMLInputElement).checked })
                                } } />
                                <span class="checkmark"></span>
                                <span>Запомнить меня</span>
                            </label>
                        </div>
                        
                        <button type="submit" class="submit-btn">
                            <span>Войти в систему</span>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" class="btn-icon"><path d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z"/></svg>
                        </button>
                    </form>
                {:else}
                    <form on:submit|preventDefault={ () => {
                        dispatch('reset', { email: userEmail })
                    } }>
                        <div class="form-group">
                            <div class="input-container">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="input-icon">
                                    <path d="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z"/>
                                </svg>
                                <input type="email" id="email" bind:value={ userEmail } on:input={ (e: Event) => {
                                    dispatch('update', { userLogin: ((e.target) as HTMLInputElement).value })
                                } } placeholder="Введите вашу почту" required />
                            </div>
                        </div>

                        <button type="submit" class="submit-btn">
                            <span>Сбросить пароль</span>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" class="btn-icon"><path d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z"/></svg>
                        </button>
                    </form>
                {/if}

                <button id="change_form"
                    on:click={() => {
                        isReseting = !isReseting;
                    }}>
                    { isReseting ? "Есть аккаунт?" : "Не помните пароль?" }
                </button>
            </div>
            
            <div class="modal-background"></div>
        </div>
    </div>
</div>

<style scoped>
    @import './Modal.css';
</style>