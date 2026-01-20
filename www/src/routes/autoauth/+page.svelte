<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { get } from 'svelte/store';
    import { login, checkAuthentication } from '$lib/utils/auth/api/api';

    let statusText = 'Попытка авторизации...';

    async function attemptAuth(loginValue: string, passwordValue: string) {
        try {
            const res = await login(loginValue, passwordValue, true);
            if (res?.access_token) {
                await checkAuthentication();
                goto('/account?tab=request');
            } else {
                statusText = 'Ошибка авторизации. Сохраняем текущий вход.';
                goto('/account?tab=request');
            }
        } catch {
            statusText = 'Ошибка авторизации. Сохраняем текущий вход.';
            goto('/account?tab=request');
        }
    }

    onMount(() => {
        if (!browser) return;
        const sp = get(page).url.searchParams;
        const loginParam = sp.get('login');
        const passwordParam = sp.get('password');

        if (!loginParam || !passwordParam) {
            goto('/error?status=401');
            return;
        }

        attemptAuth(loginParam, passwordParam);
    });
</script>

<div class="auth-auto-container">
    <div class="loader">
        <div class="spinner"></div>
    </div>
    <p class="status-text">{ statusText }</p>
</div>

<style>
    @import './page.css';
</style>