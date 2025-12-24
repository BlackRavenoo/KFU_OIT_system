<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    export let searchQuery: string = '';
    export let placeholder: string = 'Поиск...';
    export let onSearch: () => void;

    let focused: boolean = false;
    const dispatch = createEventDispatcher();

    function clearSearch() {
        searchQuery = '';
        dispatch('update', searchQuery);
        onSearch();
        setTimeout(() => {
            inputEl?.focus();
        }, 0);
    }

    let inputEl: HTMLInputElement | null = null;
</script>

<div class="search-module">
    <div class="search-block">
        <input
            type="text"
            placeholder={ placeholder }
            bind:value={ searchQuery }
            bind:this={inputEl}
            on:focus={ () => focused = true }
            on:blur={ () => focused = false }
            on:keydown={(e) => {
                if (e.key === 'Enter') onSearch();
            }}
        />
        <svg class="search-icon" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/>
            <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="2"/>
        </svg>
        {#if focused || searchQuery}
            <button
                type="button"
                class="clear-icon-btn"
                aria-label="Очистить поиск"
                on:click={ clearSearch }
                tabindex="-1"
            >
                <svg viewBox="0 0 24 24" width="22" height="22">
                    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
                    <line x1="6" y1="18" x2="18" y2="6" stroke="currentColor" stroke-width="2"/>
                </svg>
            </button>
        {/if}
    </div>
</div>

<style scoped>
    .search-module {
        display: flex;
        flex-direction: row;
        gap: 1rem;
        width: 100%;
        margin-bottom: 2rem;
    }

    .search-block {
        position: relative;
        display: flex;
        align-items: center;
        width: 100%;
        min-height: 56px;
    }

    .search-block input[type="text"] {
        width: 100%;
        padding: 0.95rem 2.8rem 0.95rem 2.8rem;
        font-size: 1.12rem;
        border: 2px solid var(--gray);
        border-radius: 32px;
        background: var(--white);
        color: var(--dark);
        transition: border-color 0.25s, box-shadow 0.25s, background 0.25s;
        box-shadow: 0 2px 8px rgba(7,92,239,0.07);
        outline: none;
    }

    .search-block input[type="text"]:focus {
        border-color: var(--light-blue);
        box-shadow: 0 6px 24px rgba(7,92,239,0.13);
        background: var(--light-gray);
    }

    .search-block input[type="text"]::placeholder {
        color: var(--blue);
        opacity: 0.6;
        font-size: 1.05rem;
        letter-spacing: 0.01em;
    }

    .search-icon {
        position: absolute;
        left: 1.2rem;
        top: 50%;
        transform: translateY(-50%);
        width: 22px;
        height: 22px;
        color: var(--blue);
        opacity: 0.8;
        transition: opacity 0.2s;
        box-shadow: none;
        pointer-events: none;
    }

    .clear-icon-btn {
        position: absolute;
        right: 1.2rem;
        top: 11px;
        background: none;
        border: none;
        cursor: pointer;
        opacity: 0.8;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
        box-shadow: none !important;
    }

    .clear-icon-btn svg {
        width: 22px;
        height: 22px;
        color: var(--blue);
    }
</style>