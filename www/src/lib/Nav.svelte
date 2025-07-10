<script lang="ts">
    import KFU_large from '../assets/KFU_large.webp';
    import KFU from '../assets/KFU.webp';

    let isAuthenticated: boolean = false;
    let isAdmin: boolean = false;
    let username: string = '';

    function login() {
        isAuthenticated = true;
        username = 'test_user';
    }
</script>

<nav>
    <div class="logo">
        <img src="{ KFU_large }" alt="KFU Logo" class="large-logo" />
        <img src="{ KFU }" alt="KFU Logo Small" class="small-logo" />
    </div>
    <ul>
        <li><a href="/" class="big">Главная</a></li>
        {#if isAuthenticated}
            <li><a href="/tickets">Заявки</a></li>
        {:else}
            <li><a href="/tickets/new">Оставить заявку</a></li>
        {/if}
        <li><a href="/contact" class="big">Контакты</a></li>
        {#if isAuthenticated}
            <li><a href="/account" class="account">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512l388.6 0c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304l-91.4 0z"/></svg>
                { username }
            </a></li>
        {:else}
            <li><button on:click={login}>Войти</button></li>
        {/if}
        {#if isAdmin}
            <li><a href="/admin" class="big">Админ-панель</a></li>
        {/if}
    </ul>
</nav>

<style>
    nav {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
        z-index: 2;
    }

    .logo img {
        height: 40px;
    }

    ul {
        list-style: none;
        display: flex;
        gap: max(25px, 2.5rem);
        height: fit-content;
        transform: translate(0, .2rem);
    }

    li a, li button {
        text-decoration: none;
        color: var(--text);
        font-weight: 400;
        font-size: 1.1rem;
        transition: color 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    li a {
        height: fit-content;
    }

    li a:hover {
        color: var(--blue);
    }

    button {
        border: none;
        background-color: var(--white);
        padding: 12px 50px;
        border-radius: 0;
        transform: translate(0, -10px);
    }

    button:hover {
        background-color: var(--blue);
        color: var(--white);
    }

    .small-logo {
        display: none;
    }

    .account {
        display: flex;
        flex-direction: row-reverse;
        align-items: center;
        gap: 10px;
    }

    .account svg {
        width: 20px;
        height: 20px;
        fill: var(--text);
        transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), fill 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .account:hover svg {
        fill: var(--blue);
        transform: scale(1.1);
    }

    @media (max-width: 980px) {
        ul {
            gap: 20px;
        }

        li a, li button {
            font-size: 1rem;
        }

        li button {
            padding: 0;
            background-color: transparent;
            color: var(--text);
            font-weight: 400;
            transform: translate(0, 0);
        }

        li button:hover {
            background-color: transparent;
            color: var(--blue);
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

        li a, li button {
            font-size: 0.9rem;
        }
    }

    @media (max-width: 480px) {
        .big {
            display: none;
        }
    }
</style>