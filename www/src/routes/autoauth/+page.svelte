<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { get } from 'svelte/store';
    import { login, checkAuthentication } from '$lib/utils/auth/api/api';
    import { currentUser } from '$lib/utils/auth/storage/initial';

    let statusText = 'Попытка авторизации...';

    async function attemptAuth(loginValue: string, passwordValue: string) {
        try {
            const res = await login(loginValue, passwordValue, true);
            if (res?.access_token) {
                await checkAuthentication();
                goto('/account?tab=request');
            } else {
                goto('/error?status=401');
            }
        } catch {
            goto('/error?status=401');
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
        } else if ($currentUser) {
            goto('/account');
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