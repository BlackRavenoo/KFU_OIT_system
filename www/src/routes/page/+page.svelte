<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { page as pageStore } from '$app/stores';
    import { get } from 'svelte/store';
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';

    import SearchBar from '$lib/components/Search/Searchfield.svelte';
    import Pagination from '$lib/components/Search/Pagination.svelte';

    import { pageTitle, pageDescription } from '$lib/utils/setup/stores';
    import { api, handleAuthError } from '$lib/utils/api';

    import { currentUser, isAuthenticated } from '$lib/utils/auth/storage/initial';
    import { UserRole } from '$lib/utils/auth/types';

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

    let tagSearchQuery = '';
    let tagSearchResults: Tag[] = [];
    let showTagDropdown = false;
    let searchingTags = false;
    let tagSearchTimer: any = null;

    let selectedTagIds: number[] = [];
    let selectedTags: Tag[] = [];

    function haveSelected(id: number) {
        return selectedTagIds.includes(id);
    }

    async function fetchPages() {
        loading = true;
        error = null;
        try {
            const params: Record<string, any> = {
                page,
                page_size: pageSize
            };
            if (search.trim()) params.search = search.trim();
            if (selectedTagIds.length > 0) params.tags = selectedTagIds.join(',');

            const resp = await api.get<PagesResponse>('/api/v1/pages/', params);
            if (!resp.success) {
                if (resp.status === 404) {
                    pages = [];
                    totalItems = 0;
                    loading = false;
                    return;
                }
                throw new Error(resp.error || `HTTP ${resp.status}`);
            }

            const payload = resp.data || {};
            const items = (payload.items ?? payload.data ?? []) as PageItem[];
            pages = items;
            totalItems = (payload.total ?? payload.total_items ?? items.length) as number;

            const maxPage = Math.max(1, Math.ceil(totalItems / pageSize));
            if (page > maxPage) {
                page = 1;
                updatePageUrl();
                await fetchPages();
            }
        } catch (e: any) {
            error = e?.message || 'Ошибка загрузки';
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

    async function searchTagsNow() {
        const q = tagSearchQuery.trim();
        if (!q) {
            tagSearchResults = [];
            showTagDropdown = false;
            return;
        }
        searchingTags = true;
        try {
            const resp = await api.get<Tag[]>('/api/v1/tags/', { q });
            if (resp.success) {
                tagSearchResults = resp.data ?? [];
                showTagDropdown = tagSearchResults.length > 0;
            } else {
                tagSearchResults = [];
                showTagDropdown = false;
            }
        } finally {
            searchingTags = false;
        }
    }

    function onTagSearchInput() {
        if (tagSearchTimer) clearTimeout(tagSearchTimer);
        tagSearchTimer = setTimeout(searchTagsNow, 250);
    }

    function addTagToSelected(tag: Tag) {
        if (!haveSelected(tag.id)) {
            selectedTagIds = [...selectedTagIds, tag.id];
            selectedTags = [...selectedTags, tag];
            page = 1;
            fetchPages();
        }
        tagSearchQuery = '';
        tagSearchResults = [];
        showTagDropdown = false;
    }

    function removeSelectedTag(id: number) {
        selectedTagIds = selectedTagIds.filter(tid => tid !== id);
        selectedTags = selectedTags.filter(t => t.id !== id);
        page = 1;
        fetchPages();
    }

    async function handleApplyFilters() {
        page = 1;
        await fetchPages();
    }

    async function handleClearFilters() {
        selectedTagIds = [];
        selectedTags = [];
        tagSearchQuery = '';
        tagSearchResults = [];
        showTagDropdown = false;
        page = 1;
        await fetchPages();
    }

    function openPage(id: number) {
        goto(`/page/${id}`);
    }

    $: canManageTags = true;//$currentUser?.role === UserRole.Administrator || $currentUser?.role === UserRole.Moderator;
    $: canDeleteTag = $currentUser?.role === UserRole.Administrator;

    let showTagsModal = false;
    let tagsList: Tag[] = [];
    let tagsLoading = false;
    let newTagName = '';
    let newTagSynonyms = '';
    let creatingTag = false;
    let manageTag: Tag | null = null;
    let synonymsInput = '';
    let addingSynonyms = false;
    let deletingTag = false;

    async function openTagsModal() {
        showTagsModal = true;
        tagsLoading = true;
        try {
            const resp = await api.get<Tag[]>('/api/v1/tags/', {});
            if (resp.success) tagsList = resp.data ?? [];
        } finally {
            tagsLoading = false;
        }
        newTagName = '';
        newTagSynonyms = '';
        manageTag = null;
        synonymsInput = '';
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
            const resp = await api.post('/api/v1/tags/', { name, synonyms });
            if (resp.success) {
                newTagName = '';
                newTagSynonyms = '';
                await openTagsModal();
            }
        } finally {
            creatingTag = false;
        }
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
            await openTagsModal();
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
            await openTagsModal();
        } finally {
            deletingTag = false;
        }
    }

    // Новый SearchBar для поиска по тегам
    let tagSearch = '';
    function handleTagSearch(q: string) {
        tagSearchQuery = q;
        onTagSearchInput();
    }

    onMount(async () => {
        pageTitle.set('Страницы | Система управления заявками ЕИ КФУ');
        pageDescription.set('Просматривайте справочные страницы и инструкции. Фильтруйте по тэгам и находите нужные материалы быстрее.');
        // if (!$isAuthenticated || $currentUser === null)
        //     handleAuthError(get(pageStore).url.pathname);
        // else await fetchPages();
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
            placeholder="Поиск по страницам..."
            onSearch={ handleSearch }
        />
        <div class="search-controls">
            <div class="tags-row">
                <SearchBar
                    bind:searchQuery={ tagSearch }
                    placeholder="Поиск по тэгам"
                    onSearch={ handleTagSearch }
                />
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
                {#if canManageTags}
                    <button class="tag-manage-btn" on:click={ openTagsModal } title="Управление тэгами">
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

    <div class="tickets-list list-view">
        {#if loading}
            <div class="ticket-item" style="align-items:center;">
                Загрузка...
            </div>
        {:else if error}
            <div class="ticket-item" style="align-items:center;">
                {error}
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
</div>

{#if showTagsModal}
    <div class="modal-backdrop">
        <div class="modal-window tag-manage-modal">
            <div class="close-button-container" style="position: relative;">
                <button class="filter-btn close-btn secondary" on:click={ () => showTagsModal = false }>x</button>
            </div>
            <h2>Управление тэгами</h2>
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
            <div class="tag-manage-list">
                <div class="tag-list-header">Существующие тэги</div>
                {#if tagsLoading}
                    <div class="tag-list-loading">Загрузка...</div>
                {:else if tagsList.length === 0}
                    <div class="tag-list-empty">Нет тегов</div>
                {:else}
                    <ul class="tag-list">
                        {#each tagsList as tag}
                            <li class:active={ manageTag && manageTag.id === tag.id }>
                                <span>{ tag.name }</span>
                                <button class="tag-syn-btn" on:click={() => selectManageTag(tag)} title="Добавить синонимы/удалить">
                                    <svg width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="2"/></svg>
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
                        <button class="danger_btn" on:click={ deleteTagCompletely } disabled={ deletingTag }>
                            { deletingTag ? 'Удаление...' : 'Удалить тэг' }
                        </button>
                    </div>
                </div>
            {/if}
        </div>
    </div>
{/if}

<style scoped>
    @import '../ticket/page.css';
    @import './page.css';
</style>