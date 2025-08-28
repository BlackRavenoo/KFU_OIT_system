<script lang="ts">
    import '../assets/app.css';
    
    import { onMount } from 'svelte';
    import { afterNavigate } from '$app/navigation';
    import { page } from '$app/stores';

    import { checkAuthentication, authCheckComplete } from '$lib/utils/auth/api/api';

    import Footer from '$lib/components/Footer/Footer.svelte';
    import Nav from '$lib/components/Nav/Nav.svelte';
    
    const pagesWithFooter = ['/', '/contact', '/faq', '/privacy'];
    
    $: showFooter = pagesWithFooter.some(path => $page.url.pathname === path);
    
    onMount(() => {
        checkAuthentication();
    });

    afterNavigate(() => {
        document.body.classList.remove('page-transitioning');
    });

    function handleTransitionStart() {
        document.body.classList.add('page-transitioning');
    }
</script>

{#if $authCheckComplete}
    <div class="container" on:outrostart={ handleTransitionStart }>
        <Nav />
        <slot></slot>
        {#if showFooter}
            <Footer />
        {/if}
    </div>
{:else}
    <div class="loading-container">
        <div class="loader"></div>
    </div>
{/if}

<style>
    :global(body.page-transitioning .nav-auth-elements) {
        visibility: hidden;
    }
    
    .loading-container {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        width: 100vw;
    }
    
    .loader {
        width: 48px;
        height: 48px;
        border: 5px solid #BAD2E6;
        border-radius: 50%;
        border-top-color: #075CEF;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>