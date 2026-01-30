<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { page as pageStore } from '$app/stores';
    import { get } from 'svelte/store';
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';

    import SearchBar from '$lib/components/Search/Searchfield.svelte';
    import Pagination from '$lib/components/Search/Pagination.svelte';

    import { pageTitle, pageDescription } from '$lib/utils/setup/stores';
    import { api } from '$lib/utils/api';

    import { currentUser } from '$lib/utils/auth/storage/initial';
    import { UserRole } from '$lib/utils/auth/types';

    import { fetchTags } from '$lib/utils/pages/tags';

    type Tag = { id: number; name: string };
    type PageItem = { id: number; is_public: boolean; title: string; key: string; tags: Tag[] };
    type PagesResponse = {
        items?: PageItem[];
        data?: PageItem[];
        total?: number;
        total_items?: number;
        page_size?: number;
    };

    let pages: PageItem[] = [];
    let loading = false;
    let error: string | null = null;

    let search = '';
    let page = 1;
    let pageSize = 10;
    let totalItems = 0;

    $: totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    $: {
        const $page = get(pageStore);
        const pageParam = $page.url.searchParams?.get('page');
        if (pageParam && !isNaN(Number(pageParam))) {
            const pn = Number(pageParam);
            if (pn > 0 && pn !== page) page = pn;
        }
    }

    function updatePageUrl() {
        if (!browser) return;
        const url = new URL(window.location.href);
        page > 1 ? url.searchParams.set('page', String(page)) : url.searchParams.delete('page');
        goto(url.toString(), { replaceState: true, keepFocus: true, noScroll: true });
    }

    let tagSearch = '';
    let tagSuggestions: Tag[] = [];
    let tagDropdownOpen = false;
    let tagSearchLoading = false;

    let selectedTagIds: number[] = [];
    let selectedTags: Tag[] = [];

    function haveSelected(id: number) {
        return selectedTagIds.includes(id);
    }

    async function fetchPages() {
        loading = true;
        error = null;
        try {
            const params: any = {
                q: search.trim() || undefined,
                page,
                page_size: pageSize
            };
            if (selectedTagIds.length > 0) {
                params.tags = selectedTagIds.map(id => String(id));
            }
            const resp = await api.get<PagesResponse>('/api/v1/pages/', params);
            if (resp.success) {
                const data = resp.data;
                pages = data?.items || data?.data || [];
                totalItems = data?.total_items ?? data?.total ?? pages.length;
            } else {
                error = resp.error || 'Ошибка загрузки';
                pages = [];
                totalItems = 0;
            }
        } catch (e: any) {
            error = e?.message || 'Ошибка загрузки';
            pages = [];
            totalItems = 0;
        } finally {
            loading = false;
        }
    }

    async function handleSearch() {
        page = 1;
        updatePageUrl();
        await fetchPages();
    }

    async function handlePageChange(newPage: number) {
        if (newPage >= 1 && newPage <= totalPages) {
            page = newPage;
            updatePageUrl();
            await fetchPages();
        }
    }

    async function handlePageSizeChange(e: Event) {
        const val = Number((e.currentTarget as HTMLInputElement).value);
        if (!Number.isNaN(val) && val > 0) {
            pageSize = val;
            page = 1;
            updatePageUrl();
            await fetchPages();
        }
    }

    async function handleTagSearch(q: string) {
        tagSearch = q;
        if (!q.trim()) {
            tagSuggestions = [];
            tagDropdownOpen = false;
            return;
        }
        tagSearchLoading = true;
        tagSuggestions = await fetchTags(q);
        tagDropdownOpen = tagSuggestions.length > 0;
        tagSearchLoading = false;
    }

    function selectTagFromSuggestion(tag: Tag) {
        if (!haveSelected(tag.id)) {
            selectedTagIds = [...selectedTagIds, tag.id];
            selectedTags = [...selectedTags, tag];
            page = 1;
            fetchPages();
        }
        tagSearch = '';
        tagSuggestions = [];
        tagDropdownOpen = false;
    }

    function removeSelectedTag(id: number) {
        selectedTagIds = selectedTagIds.filter(tid => tid !== id);
        selectedTags = selectedTags.filter(t => t.id !== id);
        page = 1;
        fetchPages();
    }

    function openPage(id: number) {
        goto(`/page/${id}`);
    }

    $: canManageTags = $currentUser?.role === UserRole.Administrator || $currentUser?.role === UserRole.Moderator;
    $: canDeleteTag = $currentUser?.role === UserRole.Administrator;

    let showTagsModal = false;
    let tagManageSearch = '';
    let tagManageSuggestions: Tag[] = [];
    let tagManageLoading = false;
    let manageTag: Tag | null = null;
    let synonymsInput = '';
    let addingSynonyms = false;
    let deletingTag = false;
    let newTagName = '';
    let newTagSynonyms = '';
    let creatingTag = false;

    async function openTagsModal() {
        showTagsModal = true;
        tagManageSearch = '';
        tagManageSuggestions = [];
        manageTag = null;
        synonymsInput = '';
    }

    async function handleTagManageSearch(q: string) {
        tagManageSearch = q;
        if (!q.trim()) {
            tagManageSuggestions = [];
            return;
        }
        tagManageLoading = true;
        tagManageSuggestions = await fetchTags(q);
        tagManageLoading = false;
    }

    function selectManageTag(tag: Tag) {
        manageTag = tag;
        synonymsInput = '';
    }

    async function addSynonymsToTag() {
        if (!manageTag) return;
        const tag_id = manageTag.id;
        const parts = synonymsInput.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length === 0) return;
        addingSynonyms = true;
        try {
            await api.put(`/api/v1/tags/${tag_id}`, { synonyms_to_add: parts });
            synonymsInput = '';
        } finally {
            addingSynonyms = false;
        }
    }

    async function deleteTagCompletely() {
        if (!manageTag) return;
        deletingTag = true;
        try {
            await api.delete(`/api/v1/tags/${manageTag.id}`);
            manageTag = null;
            tagManageSearch = '';
            tagManageSuggestions = [];
        } finally {
            deletingTag = false;
        }
    }

    async function createTagWithSynonyms() {
        if (!canManageTags) return;
        const name = newTagName.trim();
        if (!name) return;
        creatingTag = true;
        try {
            const synonyms = newTagSynonyms
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);
            await api.post('/api/v1/tags/', { name, synonyms });
            newTagName = '';
            newTagSynonyms = '';
        } finally {
            creatingTag = false;
        }
    }

    onMount(async () => {
        pageTitle.set('Страницы | Система управления заявками ЕИ КФУ');
        pageDescription.set('Просматривайте справочные страницы и инструкции. Фильтруйте по тэгам и находите нужные материалы быстрее.');
        await fetchPages();
    });

    onDestroy(() => {
        pageTitle.set('Service Desk | Система управления заявками ЕИ КФУ');
        pageDescription.set('Система обработки заявок Елабужского института КФУ.');
    });
</script>

<div class="content fullwidth-content-panel">
    <div class="search-controls-wrapper">
        <SearchBar
            bind:searchQuery={ search }
            placeholder="Поиск по страницам"
            onSearch={ handleSearch }
        />
        <div class="search-controls">
            <div class="tags-row tag-search-wrapper">
                <SearchBar
                    bind:searchQuery={ tagSearch }
                    placeholder="Поиск по тэгам"
                    onSearch={ () => handleTagSearch(tagSearch) }
                />
                {#if tagDropdownOpen}
                    <div class="tag-dropdown">
                        {#if tagSearchLoading}
                            <div class="tag-option muted">Загрузка...</div>
                        {:else if tagSuggestions.length === 0}
                            <div class="tag-option muted">Нет совпадений</div>
                        {:else}
                            {#each tagSuggestions as t}
                                <div
                                    class="tag-option"
                                    role="option"
                                    aria-selected="false"
                                    tabindex="0"
                                    on:click={ () => selectTagFromSuggestion(t) }
                                    on:keydown={ (e) => (e.key === 'Enter' || e.key === ' ') && selectTagFromSuggestion(t) }
                                    aria-label={ `Выбрать тэг ${ t.name }` }
                                >
                                    { t.name }
                                </div>
                            {/each}
                        {/if}
                    </div>
                {/if}
                {#if canManageTags}
                    <button class="tag-manage-btn" on:click={ openTagsModal } title="Управление тэгами" aria-label="Управление тэгами">
                        <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#075cef" stroke-width="2" fill="none"/><path d="M8 12h8M12 8v8" stroke="#075cef" stroke-width="2"/></svg>
                    </button>
                {/if}
            </div>
            <input
                type="number"
                class="page-size-input"
                min="10"
                max="50"
                step="1"
                bind:value={ pageSize }
                on:change={ handlePageSizeChange }
                aria-label="Размер страницы"
            />
        </div>
    </div>

    {#if selectedTags.length > 0}
        <div class="selected-tags">
            {#each selectedTags as t}
                <button type="button" class="tag-chip active" title="Убрать тэг" on:click={ () => removeSelectedTag(t.id) }>
                    { t.name }
                    <span aria-hidden="true">&times;</span>
                </button>
            {/each}
        </div>
    {/if}

    <div class="tickets-list list-view">
        {#if loading}
            <div class="ticket-item" style="align-items:center;">
                Загрузка...
            </div>
        {:else if error}
            <div class="ticket-item" style="align-items:center;">
                { error }
            </div>
        {:else if pages.length === 0}
            Нет страниц
        {:else}
            {#each pages as p}
                <div class="ticket-item"
                     role="link"
                     tabindex="0"
                     aria-label={`Открыть страницу ${ p.title }`}
                     on:click={ () => openPage(p.id) }
                     on:keydown={ (e) => (e.key === 'Enter' || e.key === ' ') && openPage(p.id) }
                >
                    <div class="doc-heading">
                        <span class="doc-icon" aria-hidden="true">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                <path d="M6 2h8l6 6v14H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
                                <path d="M14 2v6h6" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
                            </svg>
                        </span>
                        <div class="ticket-title">
                            { p.title }
                        </div>
                        <span class="doc-status { p.is_public ? 'public' : 'private' }">
                            { p.is_public ? 'Публичный' : 'Приватный' }
                        </span>
                    </div>
                    {#if p.tags?.length}
                        <div class="ticket-meta">
                            {#each p.tags as t, i}
                                <span class="tag">{ t.name }</span>{#if i < p.tags.length - 1}&nbsp;{/if}
                            {/each}
                        </div>
                    {/if}
                </div>
            {/each}
        {/if}
    </div>

    {#if totalPages > 1}
        <Pagination currentPage={ page } { totalPages } onPageChange={ handlePageChange } />
    {/if}

    {#if $currentUser && ($currentUser.role === UserRole.Administrator || $currentUser.role === UserRole.Moderator || $currentUser.role === UserRole.Programmer)}
        <div style="display: flex; justify-content: flex-end; margin-top: 1.5rem;">
            <button class="filter-btn primary add-page" on:click={ () => goto('/texteditor') }>
                + Создать новую страницу
            </button>
        </div>
    {/if}
</div>

{#if showTagsModal}
    <div class="modal-backdrop">
        <div class="modal-window tag-manage-modal">
            <div class="close-button-container" style="position: relative;">
                <button class="filter-btn close-btn secondary" on:click={ () => showTagsModal = false }>x</button>
            </div>
            <h2 style="margin: 0">Управление тэгами</h2>
            <div class="tag-manage-search">
                <SearchBar
                    bind:searchQuery={ tagManageSearch }
                    placeholder="Поиск тега для управления"
                    onSearch={ () => handleTagManageSearch(tagManageSearch) }
                />
                {#if tagManageLoading}
                    <div class="tag-list-loading">Загрузка...</div>
                {:else if tagManageSearch && tagManageSuggestions.length === 0}
                    <div class="tag-list-empty">Нет тегов</div>
                {:else if tagManageSuggestions.length > 0}
                    <ul class="tag-list tag-manage-list">
                        {#each tagManageSuggestions as tag}
                            <li class:active={ manageTag && manageTag.id === tag.id }>
                                <span>{ tag.name }</span>
                                <button class="tag-syn-btn" on:click={ () => selectManageTag(tag) } title="Добавить синонимы" aria-label="Добавить синонимы">
                                    <svg width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#075cef" stroke-width="2" fill="none"/><path d="M8 12h8M12 8v8" stroke="#075cef" stroke-width="2"/></svg>
                                </button>
                                <button class="danger_btn" style="margin-left:8px;" on:click={ async () => { manageTag = tag; await deleteTagCompletely(); }} title="Удалить" aria-label="Удалить">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                        <rect x="5" y="7" width="14" height="12" rx="2" stroke="#d32f2f" stroke-width="2" fill="none"/>
                                        <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="#d32f2f" stroke-width="2"/>
                                        <line x1="10" y1="11" x2="10" y2="17" stroke="#d32f2f" stroke-width="2"/>
                                        <line x1="14" y1="11" x2="14" y2="17" stroke="#d32f2f" stroke-width="2"/>
                                        <line x1="3" y1="7" x2="21" y2="7" stroke="#d32f2f" stroke-width="2"/>
                                    </svg>
                                </button>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </div>
            {#if manageTag}
                <div class="tag-manage-synonyms">
                    <div>Синонимы для тэга "{ manageTag.name }"</div>
                    <input
                        type="text"
                        placeholder="Синонимы через запятую"
                        bind:value={ synonymsInput }
                    />
                    <div class="modal-actions">
                        <button class="filter-btn" on:click={ addSynonymsToTag } disabled={ addingSynonyms || !synonymsInput.trim() }>
                            { addingSynonyms ? 'Добавление...' : 'Добавить' }
                        </button>
                    </div>
                </div>
            {/if}
            <div class="tag-manage-create">
                <input
                    type="text"
                    placeholder="Название нового тэга"
                    bind:value={ newTagName }
                />
                <input
                    type="text"
                    placeholder="Синонимы через запятую (опционально)"
                    bind:value={ newTagSynonyms}
                />
                <button class="filter-btn primary" on:click={ createTagWithSynonyms } disabled={ creatingTag || !newTagName.trim() }>
                    { creatingTag ? 'Создание...' : 'Создать' }
                </button>
            </div>
        </div>
    </div>
{/if}

<style scoped>
    @import '../ticket/page.css';
    @import './page.css';
</style>