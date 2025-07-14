<script lang="ts">
    import KFU_large from '../assets/KFU_large.webp';
    import KFU from '../assets/KFU.webp';
    import { fly, fade, scale } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';

    export let pageTitle: string = 'ОИТ | Система управления заявками ЕИ КФУ';
    export let pageDescription: string = 'Система обработки заявок Отдела Информационных Технологий Елабужского института Казанского Федерального Университета. Система позволяет создавать заявки на услуги ОИТ, отслеживать их статус, получать советы для самостоятельного решения проблемы и многое другое.';

    let isAuthenticated: boolean = false;
    let isAdmin: boolean = false;
    let isClosing: boolean = false;

    let showModal: boolean = false;
    
    let username: string = '';
    let password: string = '';
    let rememberMe: boolean = false;

    function login() {
        if (username && password) {
            isAuthenticated = true;
            showModal = false;
        }
    }

    function toggleModal() {
        if (showModal) {
            isClosing = true;
            showModal = false;
            
            setTimeout(() => {
                isClosing = false;
            }, 400);
        } else {
            showModal = true;
            isClosing = false;
        }
    }
</script>

<svelte:head>
    <title>{ pageTitle }</title>
    <meta name="description" content={ pageDescription }>
</svelte:head>

<nav>
    <div class="logo">
        <img src="{ KFU_large }" alt="KFU Logo" class="large-logo" />
        <img src="{ KFU }" alt="KFU Logo Small" class="small-logo" />
    </div>
    <ul>
        <li><a href="/" class="big nav-link">Главная</a></li>
        {#if isAuthenticated}
            <li><a href="/tickets" class="nav-link">Заявки</a></li>
        {:else}
            <li><a href="/tickets/new" class="nav-link">Оставить заявку</a></li>
        {/if}
        <li><a href="/contact" class="big nav-link">Контакты</a></li>
        {#if isAuthenticated}
            <li>
                <a href="/account" class="account">
                    <span class="account-avatar">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512l388.6 0c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304l-91.4 0z"/></svg>
                    </span>
                    <span class="account-name">{ username }</span>
                </a>
            </li>
        {:else}
            <li><button class="login-btn" on:click={ toggleModal }>Войти</button></li>
        {/if}
        {#if isAdmin}
            <li><a href="/admin" class="big admin-link">Админ-панель</a></li>
        {/if}
    </ul>
</nav>

{#if showModal && !isAuthenticated}
    <div class="modal-overlay" transition:fade={{ duration: 200 }}>
        <div class="modal-container">
            <button class="modal-backdrop" on:click={toggleModal}>x</button>
            <div class="modal" class:closing={isClosing} transition:scale={{ duration: 300, start: 0.95, opacity: 0, easing: cubicOut }}>
                <button class="modal-close" on:click={toggleModal} aria-label="Закрыть окно">
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
                        <h2>Авторизация</h2>
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
                    
                    <form on:submit|preventDefault={login}>
                        <div class="form-group">
                            <div class="input-container">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" class="input-icon"><path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512l388.6 0c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304l-91.4 0z"/></svg>
                                <input type="text" id="username" bind:value={username} placeholder="Введите ваш логин" required />
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <div class="input-container">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" class="input-icon"><path d="M144 144v48H304V144c0-44.2-35.8-80-80-80s-80 35.8-80 80zM80 192V144C80 64.5 144.5 0 224 0s144 64.5 144 144v48h16c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V256c0-35.3 28.7-64 64-64H80z"/></svg>
                                <input type="password" id="password" bind:value={password} placeholder="Введите ваш пароль" required />
                            </div>
                        </div>
                        
                        <div class="remember-container">
                            <label class="remember-label">
                                <input type="checkbox" bind:checked={rememberMe} />
                                <span class="checkmark"></span>
                                <span>Запомнить меня</span>
                            </label>
                        </div>
                        
                        <button type="submit" class="submit-btn">
                            <span>Войти в систему</span>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" class="btn-icon"><path d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z"/></svg>
                        </button>
                    </form>
                </div>
                
                <div class="modal-background"></div>
            </div>
        </div>
    </div>
{/if}

<style>
    /* --- Навигация --- */
    nav {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 30px;
        z-index: 2;
    }

    .logo {
        display: flex;
        align-items: center;
    }

    .logo img {
        height: 40px;
        transition: transform 0.3s ease;
    }
    
    .logo:hover img {
        transform: scale(1.02);
    }

    ul {
        list-style: none;
        display: flex;
        gap: clamp(20px, 3vw, 40px);
        height: fit-content;
        align-items: center;
        margin: 0;
        padding: 0;
    }

    li {
        position: relative;
    }

    .nav-link {
        text-decoration: none;
        color: var(--text);
        font-weight: 500;
        font-size: 1rem;
        padding: 6px 2px;
        position: relative;
        transition: all 0.25s ease;
    }

    .nav-link::after {
        content: '';
        position: absolute;
        width: 0;
        height: 2px;
        bottom: 0;
        left: 0;
        background-color: var(--blue);
        transition: width 0.3s ease;
    }

    .nav-link:hover {
        color: var(--blue);
    }

    .nav-link:hover::after {
        width: 100%;
    }

    .small-logo {
        display: none;
    }

    /* Кнопка входа */
    .login-btn {
        position: relative;
        border: none;
        background-color: var(--blue);
        color: var(--white);
        font-weight: 500;
        font-size: 0.95rem;
        padding: 10px 24px;
        border-radius: 30px;
        cursor: pointer;
        overflow: hidden;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(7, 92, 239, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .login-btn:hover {
        background-color: var(--dark);
        transform: translateY(-2px);
        box-shadow: 0 6px 15px rgba(7, 92, 239, 0.3);
    }

    .login-btn:active {
        transform: translateY(0);
        box-shadow: 0 2px 8px rgba(7, 92, 239, 0.2);
    }

    /* Аккаунт */
    .account {
        display: flex;
        flex-direction: row-reverse;
        align-items: center;
        gap: 8px;
        text-decoration: none;
        color: var(--text);
        font-weight: 500;
        padding: 6px 12px;
        border-radius: 30px;
        transition: all 0.3s ease;
    }
    
    .account:hover {
        background-color: rgba(7, 92, 239, 0.1);
        color: var(--blue);
    }

    .account-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        background-color: rgba(7, 92, 239, 0.1);
        border-radius: 50%;
        overflow: hidden;
        transition: all 0.3s ease;
    }

    .account svg {
        width: 16px;
        height: 16px;
        fill: var(--blue);
        transition: all 0.3s ease;
    }

    .account:hover .account-avatar {
        transform: scale(1.1);
        background-color: var(--blue);
    }
    
    .account:hover svg {
        fill: white;
    }

    .admin-link {
        color: #d14747;
    }
    
    .admin-link:hover {
        color: #b31d1d;
    }
    
    .admin-link::after {
        background-color: #d14747;
    }

    /* --- Модальное окно --- */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
    }

    .modal-container {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        position: relative;
    }

    .modal-backdrop {
        position: absolute;
        color: transparent;
        top: 0;
        left: 0;
        width: 100%;
        height: 120vh;
        transform: translate(0, -10%);
        background-color: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(3px);
        cursor: pointer;
    }

    .modal {
        position: relative;
        background-color: white;
        border-radius: 12px;
        width: 400px;
        max-width: 90%;
        overflow: hidden;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        z-index: 101;
    }

    .modal-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: rgba(0, 0, 0, 0);
        color: var(--text);
        border-radius: 50%;
        cursor: pointer;
        z-index: 3;
        transition: all 0.2s ease;
        padding: 0;
    }

    .modal-close:hover {
        background: rgba(0, 0, 0, 0.1);
        transform: rotate(90deg);
    }

    .modal-content {
        position: relative;
        flex-direction: column;
        padding: 30px;
        z-index: 2;
    }

    .modal-header {
        text-align: center;
        margin-bottom: 20px;
    }

    .logo-container {
        margin-bottom: 15px;
        display: inline-block;
    }
    
    .logo-container img {
        height: 50px;
        filter: none;
        opacity: 1;
    }

    .modal-header h2 {
        font-size: 1.8rem;
        font-weight: 600;
        color: var(--dark);
        margin: 0;
    }

    /* Предупреждение */
    .warning-message {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 16px;
        background-color: rgba(7, 92, 239, 0.05);
        border-radius: 8px;
        margin-bottom: 24px;
    }

    .warning-icon {
        flex-shrink: 0;
    }

    .warning-icon svg {
        width: 24px;
        height: 24px;
        fill: var(--blue);
    }

    .warning-text span {
        display: block;
        font-weight: 600;
        color: var(--blue);
        margin-bottom: 5px;
    }

    .warning-text p {
        margin: 0;
        font-size: 0.9rem;
        color: var(--text);
        line-height: 1.5;
    }

    /* Форма */
    form {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .input-container {
        position: relative;
        display: flex;
        align-items: center;
    }

    .input-icon {
        position: absolute;
        left: 12px;
        width: 16px;
        height: 16px;
        fill: #aaa;
        transition: fill 0.3s ease;
    }

    input[type="text"],
    input[type="password"] {
        width: 100%;
        padding: 12px 12px 12px 38px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        font-size: 1rem;
        transition: all 0.3s ease;
    }

    input[type="text"]:focus,
    input[type="password"]:focus {
        border-color: var(--blue);
        outline: none;
        box-shadow: 0 0 0 3px rgba(7, 92, 239, 0.1);
    }

    /* Запомнить меня */
    .remember-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }

    .remember-label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 0.9rem;
        user-select: none;
    }

    .remember-label input {
        position: absolute;
        opacity: 0;
        cursor: pointer;
    }

    .remember-label span {
        color: var(--text);
    }

    .checkmark {
        position: relative;
        height: 18px;
        width: 18px;
        background-color: #f5f5f5;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        transition: all 0.2s ease;
    }

    .remember-label:hover .checkmark {
        background-color: #eef3ff;
    }

    .remember-label input:checked ~ .checkmark {
        background-color: var(--blue);
        border-color: var(--blue);
    }

    .checkmark:after {
        content: "";
        position: absolute;
        display: none;
        left: 6px;
        top: 2px;
        width: 4px;
        height: 8px;
        border: solid white;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
    }

    .remember-label input:checked ~ .checkmark:after {
        display: block;
    }

    /* Кнопка входа */
    .submit-btn {
        background-color: var(--blue);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 14px 20px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        box-shadow: 0 4px 12px rgba(7, 92, 239, 0.2);
    }

    .submit-btn:hover {
        background-color: var(--dark);
        transform: translateY(-2px);
        box-shadow: 0 6px 15px rgba(7, 92, 239, 0.3);
    }

    .submit-btn:active {
        transform: translateY(0);
    }

    .btn-icon {
        width: 16px;
        height: 16px;
        fill: currentColor;
        transition: transform 0.3s ease;
    }

    .submit-btn:hover .btn-icon {
        transform: translateX(4px);
    }

    .modal-background {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: white;
        background-image: radial-gradient(circle at 90% 10%, rgba(7, 92, 239, 0.03) 0%, transparent 60%),
                          radial-gradient(circle at 10% 90%, rgba(7, 92, 239, 0.03) 0%, transparent 60%);
        z-index: 1;
    }

    /* Медиа запросы */
    @media (max-width: 980px) {
        ul {
            gap: 20px;
        }
    }

    @media (max-width: 780px) {
        .large-logo {
            display: none
        }
        
        .small-logo {
            display: block;
        }

        ul {
            gap: 15px;
        }

        .nav-link {
            font-size: 0.95rem;
        }
        
        nav {
            padding: 10px 15px;
        }
    }

    @media (max-width: 480px) {
        .big {
            display: none;
        }

        .login-btn {
            padding: 8px 16px;
            font-size: 0.9rem;
        }

        .modal-content {
            padding: 20px;
        }

        .warning-message {
            padding: 12px;
        }
    }
</style>