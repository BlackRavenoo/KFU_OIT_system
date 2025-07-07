<script lang="ts">
    import { base } from '$app/paths'

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
        <img src="{base}/KFU_large.webp" alt="KFU Logo" />
    </div>
    <ul>
        <li><a href="/">Главная</a></li>
        {#if isAuthenticated}
            <li><a href="/tickets">Заявки</a></li>
        {:else}
            <li><a href="/tickets/new">Оставить заявку</a></li>
        {/if}
        <li><a href="/contact">Контакты</a></li>
        {#if isAuthenticated}
            <li><a href="/account">{ username }</a></li>
        {:else}
            <li><button on:click={login}>Войти</button></li>
        {/if}
        {#if isAdmin}
            <li><a href="/admin">Админ-панель</a></li>
        {/if}
    </ul>
</nav>

<style>
    nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
    }

    .logo img {
        height: 40px;
    }

    ul {
        list-style: none;
        display: flex;
        gap: 20px;
    }

    li a {
        text-decoration: none;
        color: var(--blue);
        font-weight: bold;
    }

    li a:hover {
        color: #747bff;
    }
</style>