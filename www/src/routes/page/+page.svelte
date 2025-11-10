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
        goto(`/pages/${id}`);
    }

    $: canManageTags = $currentUser?.role === UserRole.Administrator || $currentUser?.role === UserRole.Moderator;
    $: canDeleteTag = $currentUser?.role === UserRole.Administrator;

    let newTagName = '';
    let creatingTag = false;

    async function createTag() {
        if (!canManageTags) return;
        const name = newTagName.trim();
        if (!name) return;
        creatingTag = true;
        try {
            const resp = await api.post('/api/v1/tags/', { name, synonyms: [] });
            if (resp.success) {
                newTagName = '';
                if (tagSearchQuery.trim()) searchTagsNow();
            }
        } finally {
            creatingTag = false;
        }
    }

    let selectedSynonymTagId: number | '' = '';
    let synonymText = '';
    let addingSynonym = false;

    async function addSynonym() {
        if (!canManageTags) return;
        const tag_id = Number(selectedSynonymTagId);
        const raw = synonymText.trim();
        if (!tag_id || !raw) return;
        const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.length === 0) return;

        addingSynonym = true;
        try {
            const resp = await api.put(`/api/v1/tags/${tag_id}`, {
                synonyms_to_add: parts
            });
            if (resp.success) {
                synonymText = '';
            }
        } finally {
            addingSynonym = false;
        }
    }

    let deletingTag = false;
    async function deleteTagCompletely() {
        if (!canDeleteTag) return;
        const tag_id = Number(selectedSynonymTagId);
        if (!tag_id) return;
        deletingTag = true;
               try {
            const resp = await api.delete(`/api/v1/tags/${tag_id}`);
            if (resp.success) {
                removeSelectedTag(tag_id);
                selectedSynonymTagId = '';
                await fetchPages();
            }
        } finally {
            deletingTag = false;
        }
    }

    let manageTagsOpen = false;

    onMount(async () => {
        pageTitle.set('Страницы | Система управления заявками ЕИ КФУ');
        pageDescription.set('Просматривайте справочные страницы и инструкции. Фильтруйте по тэгам и находите нужные материалы быстрее.');
        await fetchPages();
    });

    onDestroy(() => {
        pageTitle.set('ОИТ | Система управления заявками ЕИ КФУ');
        pageDescription.set('Система обработки заявок Отдела ИТ Елабужского института КФУ.');
    });
</script>

<div id="content-panel">
    <aside>
        <button id="clear_filters" on:click={ handleClearFilters }>Сбросить</button>

        <div class="filter">
            <span class="filter_name">Поиск по тэгам</span>

            <div class="filter_case tag-search-wrapper" style="grid-template-columns: 1fr;">
                <input
                    type="text"
                    placeholder="Начните вводить..."
                    bind:value={ tagSearchQuery }
                    on:input={ onTagSearchInput }
                    on:focus={ () => (showTagDropdown = tagSearchResults.length > 0) }
                    on:keydown={ (e) => {
                        if (e.key === 'Escape') showTagDropdown = false;
                    } }
                />

                {#if tagSearchQuery && showTagDropdown}
                    <div class="tag-dropdown">
                        {#if searchingTags}
                            <div class="tag-option muted">Поиск...</div>
                        {:else if tagSearchResults.length === 0}
                            <div class="tag-option muted">Ничего не найдено</div>
                        {:else}
                            {#each tagSearchResults as r}
                                <button
                                    type="button"
                                    class="tag-option"
                                    on:click={() => addTagToSelected(r)}
                                >
                                    { r.name }
                                </button>
                            {/each}
                        {/if}
                    </div>
                {/if}
            </div>

            {#if selectedTags.length > 0}
                <div class="selected-tags">
                    {#each selectedTags as t}
                        <button
                            type="button"
                            class="tag-chip active"
                            title="Нажмите, чтобы убрать тэг из фильтра"
                            on:click={ () => removeSelectedTag(t.id) }
                        >
                            { t.name }
                        </button>
                    {/each}
                </div>
            {/if}
        </div>

        {#if canManageTags}
            <button
                type="button"
                class="tag-manage-toggle"
                aria-expanded={ manageTagsOpen }
                aria-controls="tag-manage-sections"
                on:click={ () => manageTagsOpen = !manageTagsOpen }
            >
                Управление тэгами
                <span class="arrow" class:open={ manageTagsOpen } aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </span>
            </button>
            <div id="tag-manage-sections" class="tag-manage-block { manageTagsOpen ? 'open' : '' }">
                <div class="filter">
                    <span class="filter_name">Создание тэга</span>
                    <div class="filter_case" style="grid-template-columns: 1fr; gap: 8px;">
                        <input
                            type="text"
                            placeholder="Название тэга"
                            bind:value={ newTagName }
                            on:keydown={ (e) => e.key === 'Enter' && createTag() }
                        />
                        <button class="filter_access" on:click={ createTag } disabled={ creatingTag }>
                            { creatingTag ? 'Создание...' : 'Создать тэг' }
                        </button>
                    </div>
                </div>

                <div class="filter">
                    <span class="filter_name">Синонимы к тэгам</span>
                    <div class="filter_case" style="grid-template-columns: 1fr; gap: 8px;">
                        <select bind:value={ selectedSynonymTagId }>
                            <option value="" disabled selected>Выберите тэг</option>
                            {#each [...selectedTags, ...tagSearchResults.filter(r => !selectedTags.some(s => s.id === r.id))] as t (t.id)}
                                <option value={ t.id }>{ t.name }</option>
                            {/each}
                        </select>

                        <input
                            type="text"
                            placeholder="Синонимы через запятую"
                            class="synonym-input"
                            bind:value={ synonymText }
                            on:keydown={ (e) => e.key === 'Enter' && addSynonym() }
                        />
                        <div class="syn-controls">
                            <button class="filter_access" on:click={ addSynonym } disabled={ addingSynonym || !selectedSynonymTagId || !synonymText.trim() }>
                                { addingSynonym ? 'Добавление...' : 'Добавить' }
                            </button>
                            {#if canDeleteTag}
                                <button class="danger_btn" on:click={ deleteTagCompletely } disabled={ deletingTag || !selectedSynonymTagId }>
                                    { deletingTag ? 'Удаление...' : 'Удалить' }
                                </button>
                            {/if}
                        </div>
                    </div>
                </div>
            </div>
        {/if}

        <button on:click={ handleApplyFilters }>Применить</button>
    </aside>

    <main>
        <div class="search-controls-wrapper">
            <SearchBar
                bind:searchQuery={ search }
                placeholder="Поиск по страницам..."
                onSearch={ handleSearch }
            />
            <div class="search-controls">
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

        {#if !loading && !error && pages.length === 0}
            Нет страниц
        {:else}
            <div class="tickets-list list-view">
                {#if loading}
                    <div class="ticket-item" style="align-items:center;">
                        Загрузка...
                    </div>
                {:else if error}
                    <div class="ticket-item" style="align-items:center;">
                        { error }
                    </div>
                {:else}
                    {#each pages as p}
                        <div class="ticket-item"
                             role="link"
                             tabindex="0"
                             aria-label={ `Открыть страницу ${ p.title }` }
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
        {/if}

        {#if totalPages > 1}
            <Pagination currentPage={ page } { totalPages } onPageChange={ handlePageChange } />
        {/if}
    </main>
</div>

<style scoped>
    @import '../ticket/page.css';
    @import './page.css';
</style>