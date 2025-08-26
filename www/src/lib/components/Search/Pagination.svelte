<script lang="ts">
    export let currentPage: number;
    export let totalPages: number;
    export let onPageChange: (page: number) => void;
</script>

{#if totalPages > 1}
    <div class="pagination-block">
        {#if currentPage > 1}
            <button 
                aria-label="Назад" 
                class="pagination-button" 
                on:click={ () => onPageChange(currentPage - 1) }
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
                    <path d="M416 160C416 147.1 408.2 135.4 396.2 130.4C384.2 125.4 370.5 128.2 361.3 137.3L201.3 297.3C188.8 309.8 188.8 330.1 201.3 342.6L361.3 502.6C370.5 511.8 384.2 514.5 396.2 509.5C408.2 504.5 416 492.9 416 480L416 160z"/>
                </svg>
            </button>
        {/if}
        <span>Стр. { currentPage } из { totalPages }</span>
        {#if currentPage < totalPages}
            <button 
                aria-label="Вперёд" 
                class="pagination-button" 
                on:click={ () => onPageChange(currentPage + 1) }
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
                    <path d="M224.5 160C224.5 147.1 232.3 135.4 244.3 130.4C256.3 125.4 270 128.2 279.1 137.4L439.1 297.4C451.6 309.9 451.6 330.2 439.1 342.7L279.1 502.7C269.9 511.9 256.2 514.6 244.2 509.6C232.2 504.6 224.5 492.9 224.5 480L224.5 160z"/>
                </svg>
            </button>
        {/if}
    </div>
{/if}

<style scoped>
    .pagination-block {
        display: flex;
        justify-content: center;
        align-items: center;
        align-self: center;
        gap: 1rem;
        margin-top: 1.5rem;
    }

    .pagination-button {
        background: transparent !important;
        box-shadow: none !important;
        color: var(--blue) !important;
        border: none;
        padding: 14px 20px;
        cursor: pointer;
        top: -.5rem;
    }

    .pagination-button svg {
        width: 24px;
        height: 24px;
        fill: var(--blue);
    }
</style>