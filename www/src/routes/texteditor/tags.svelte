<script lang="ts">
    import { currentUser } from '$lib/utils/auth/storage/initial';
    import { UserRole } from '$lib/utils/auth/types';
    import type { ServerTagDto } from '$lib/utils/pages/tags';

    export let selectedTags: ServerTagDto[] = [];
    export let showTagInput = false;
    export let tagQuery = '';
    export let tagSuggestions: ServerTagDto[] = [];
    export let tagLoading = false;

    export let addButtonText = '+ Добавить';
    export let addButtonStyle = '';

    export let onToggleMenu: () => void;
    export let debouncedTagSearch: (q: string) => void;
    export let handleTagSearch: () => void | Promise<void>;
    export let addTagFromSuggestion: (t: ServerTagDto) => void;
    export let removeTag: (id: number) => void;
    export let createTag: (name: string) => void | Promise<void>;
</script>

<h3>Тэги</h3>
<div class="tag-container">
    {#each selectedTags as tag (tag.id)}
        <button class="tag-btn" on:click={ () => removeTag(tag.id) }>{ tag.name } ×</button>
    {/each}

    <div class="floating-wrapper">
        <button
            title="Добавить тэг"
            aria-label="Добавить тэг"
            class="meta-add-btn"
            style={ addButtonStyle }
            on:click={ onToggleMenu }
        >{ addButtonText }</button>

        {#if showTagInput}
            <div class="floating-menu tag-menu">
                <div class="floating-form">
                    <!-- svelte-ignore a11y_autofocus -->
                    <input
                        type="text"
                        placeholder="Поиск тэгов..."
                        bind:value={ tagQuery }
                        on:input={ () => debouncedTagSearch(tagQuery) }
                        on:keydown={ (e) => { if (e.key === 'Enter') handleTagSearch(); } }
                        aria-label="Поиск тэгов"
                        autofocus
                    />
                    <button on:click={ handleTagSearch } class="meta-add-btn floating-submit">Поиск</button>
                </div>

                {#if tagLoading}
                    <div class="no-related">Поиск...</div>
                {:else if tagSuggestions.length > 0}
                    <ul class="tag-suggestions">
                        {#each tagSuggestions as ft (ft.id)}
                            <li>
                                <button class="meta-add-btn meta-suggest-btn" on:click={ () => addTagFromSuggestion(ft) }>{ ft.name }</button>
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <div class="no-related">Ничего не найдено</div>
                    {#if ($currentUser?.role === UserRole.Moderator || $currentUser?.role === UserRole.Administrator) && tagQuery.trim().length}
                        <div class="create-tag-row">
                            <button class="meta-add-btn" on:click={ () => createTag(tagQuery) }>Создать +</button>
                        </div>
                    {/if}
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    @import './page.css';
</style>