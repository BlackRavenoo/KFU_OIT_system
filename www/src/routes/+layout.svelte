<script lang="ts">
    import '../assets/app.css';
    
    import { onMount } from 'svelte';
    import { navigating } from '$app/stores';
    
    import { getUserData } from '$lib/utils/auth/api/api';
    import { checkToken } from '$lib/utils/auth/tokens/tokens';
    import { currentUser, isAuthenticated } from '$lib/utils/auth/storage/initial';

    import Footer from '$lib/components/Footer/Footer.svelte';
    import Nav from '$lib/components/Nav/Nav.svelte';
    
    let authChecked = false;

    /**
     * Проверка аутентификации пользователя.
     * Получает данные пользователя, если токен действителен.
     * Инциализирует состояние аутентификации и текущего пользователя.
    */
    onMount(async () => {
        if (!authChecked) {
            const tokenData = localStorage.getItem('auth_tokens');
        
            if (tokenData) {
                try {
                    const tokens = JSON.parse(tokenData);
                    if (tokens && tokens.accessToken) {
                        $isAuthenticated = true;
              
                        checkToken().then(async isValid => {
                            if (isValid) {
                                const user = await getUserData();
                                if (user) $currentUser = user;
                            } else {
                                $isAuthenticated = false;
                                $currentUser = null;
                            }
                        });
                    }
                } catch (e) {
                    console.error('Ошибка при разборе токенов:', e);
                }
            }
            authChecked = true;
        }
    });
    
    /**
     * Отслеживание навигации для добавления класса к body.
     * Позволяет управлять стилями во время переходов между страницами.
    */
    $: if ($navigating) {
        document.body.classList.add('page-transitioning');
    } else {
        document.body.classList.remove('page-transitioning');
    }
</script>

<div class="container">
    <Nav />

    <slot></slot>

    <Footer />
</div>

<style>
    :global(body.page-transitioning .nav-auth-elements) {
        visibility: hidden;
    }
</style>