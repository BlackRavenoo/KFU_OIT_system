<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { page as pageStore } from '$app/stores';
    import { get } from 'svelte/store';
    import { pageTitle } from '$lib/utils/setup/stores';
    import { goto } from '$app/navigation';
    import { execCommand, applyColor, applyBgColor, insertList, insertBlock, setAlign } from '$lib/utils/texteditor/text';
    import { insertTable } from '$lib/utils/texteditor/table';
    import { notification, NotificationType } from '$lib/utils/notifications/notification';
    import { currentUser, isAuthenticated } from '$lib/utils/auth/storage/initial';
    import { getAvatar } from '$lib/utils/account/avatar';
    import { savePageAndGetId } from '$lib/utils/pages/document';
    import { fetchRelated as fetchRelatedApi, addRelated as addRelatedUtil, removeRelated as removeRelatedUtil } from '$lib/utils/pages/related';
    import type { ServerTagDto } from '$lib/utils/pages/tags';
    import { fetchTags as fetchTagsApi, createTagIfAllowed, addTagFromSuggestion as addTagFromSuggestionUtil, removeTag as removeTagUtil } from '$lib/utils/pages/tags';
    import { api } from '$lib/utils/api';
    import Tags from './tags.svelte';
    import { UserRole } from '$lib/utils/auth/types';
    import { fetchPageContentByKey } from '$lib/utils/pages/document';

    let title: string = 'Безымянный документ';
    let editingTitle: boolean = false;
    let content: string = '';
    let editorDiv: HTMLDivElement | null = null;
    let colorPickerValue: string = '#000000';

    let isBold: boolean = false;
    let isItalic: boolean = false;
    let isUnderline: boolean = false;
    let isCode: boolean = false;
    let isQuote: boolean = false;
    let isH1: boolean = false;
    let isH2: boolean = false;
    let isH3: boolean = false;
    let align: 'left' | 'center' | 'right' | 'justify' = 'left';

    let showTableMenu: boolean = false;
    let tableRows: number = 2;
    let tableCols: number = 2;

    let isPublic: boolean = false;

    let selectedTags: ServerTagDto[] = [];
    let showTagInput: boolean = false;
    let tagQuery: string = '';
    let tagSuggestions: ServerTagDto[] = [];
    let tagLoading: boolean = false;

    let selectedRelated: { id: string; title: string }[] = [];
    let showRelatedInput: boolean = false;
    let relatedQuery: string = '';
    let relatedSuggestions: { id: string; title: string }[] = [];
    let relatedLoading: boolean = false;

    let tagSearchTimer: ReturnType<typeof setTimeout> | null = null;
    let relatedSearchTimer: ReturnType<typeof setTimeout> | null = null;

    function debouncedTagSearch(_q: string) {
        if (tagSearchTimer) clearTimeout(tagSearchTimer);
        tagSearchTimer = setTimeout(() => { void handleTagSearch(); }, 250);
    }

    function debouncedRelatedSearch(_q: string) {
        if (relatedSearchTimer) clearTimeout(relatedSearchTimer);
        relatedSearchTimer = setTimeout(() => { void handleRelatedSearch(); }, 250);
    }

    async function handleTagSearch() {
        const q = tagQuery.trim();
        if (!q || q.length < 2) { tagSuggestions = []; return; }
        tagLoading = true;
        try {
            tagSuggestions = await fetchTagsApi(q);
        } catch {
            tagSuggestions = [];
        } finally {
            tagLoading = false;
        }
    }

    async function createTag(name: string) {
        const trimmed = (name ?? '').trim();
        if (!trimmed) return;
        try {
            const created = await createTagIfAllowed(trimmed);
            if (!selectedTags.some(t => t.id === created.id)) selectedTags = [...selectedTags, created];
            tagQuery = '';
            tagSuggestions = [];
            showTagInput = false;
        } catch {
            notification('Не удалось создать тэг', NotificationType.Error);
        }
    }

    function addTagFromSuggestion(tag: ServerTagDto) {
        selectedTags = addTagFromSuggestionUtil(selectedTags, tag, tagSuggestions);
        tagQuery = '';
        tagSuggestions = [];
        showTagInput = false;
    }

    function removeTag(id: number) {
        selectedTags = removeTagUtil(selectedTags, id);
    }

    async function handleRelatedSearch() {
        const q = relatedQuery.trim();
        if (!q) { relatedSuggestions = []; return; }
        relatedLoading = true;
        try {
            relatedSuggestions = await fetchRelatedApi(q);
        } catch {
            relatedSuggestions = [];
        } finally {
            relatedLoading = false;
        }
    }

    function addRelated(item?: { id: string; title: string }) {
        if (!item) return;
        if (!selectedRelated.some(r => r.id === item.id))
            selectedRelated = [...selectedRelated, { id: item.id, title: item.title }];

            relatedQuery = '';
        relatedSuggestions = [];
        showRelatedInput = false;
    }

    function removeRelated(id: string) {
        selectedRelated = removeRelatedUtil(selectedRelated, id);
    }

    function setContent(newContent: string) {
        content = newContent;
        if (editorDiv) editorDiv.innerHTML = newContent;
    }

    function setShowTableMenu(show: boolean) { showTableMenu = show; }

    function handleEditorInput() {
        updateActiveStates();
        content = editorDiv?.innerHTML ?? '';
    }

    function handleTitleBlur() {
        editingTitle = false;
        if (!title.trim()) title = 'Безымянный документ';
    }

    function handleTitleKeydown(e: KeyboardEvent) {
        (e.key === 'Enter' || e.key === 'Escape') && (e.target as HTMLInputElement).blur();
    }

    function goBack() { 
        goto('/page');
     }

    function handleTab(e: KeyboardEvent) {
        if (e.key !== 'Tab') return;
        e.preventDefault();
        if (!editorDiv || selectionInsideCodeOrQuote()) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        const tabNode = document.createTextNode('    ');
        range.deleteContents();
        range.insertNode(tabNode);
        range.setStartAfter(tabNode);
        range.setEndAfter(tabNode);
        selection.removeAllRanges();
        selection.addRange(range);
        content = editorDiv.innerHTML;
        updateActiveStates();
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (!editorDiv) return;
        e.stopPropagation();
        if (e.key === 'Tab') {
            handleTab(e);
            return;
        }
    }

    function selectionInsideCodeOrQuote(): boolean {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return false;
        let node: Node | null = selection.anchorNode;
        while (node && node !== editorDiv) {
            if (node.nodeName === 'CODE' || node.nodeName === 'BLOCKQUOTE') return true;
            node = node.parentNode;
        }
        return false;
    }

    function updateActiveStates() {
        if (!editorDiv) return;
        const selection = window.getSelection();
        let node: Node | null = selection && selection.anchorNode;
        if (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode as Node | null;
        isBold = false;
        isItalic = false;
        isUnderline = false;
        isCode = false;
        isQuote = false;
        isH1 = false;
        isH2 = false;
        isH3 = false;
        align = 'left';
        let alignNode = node as Node | null;
        while (alignNode && alignNode !== editorDiv) {
            if (alignNode instanceof HTMLElement && /^(P|DIV|LI|BLOCKQUOTE|H1|H2|H3|H4|H5|H6|TD|TH)$/i.test(alignNode.nodeName)) {
                const ta = (window.getComputedStyle(alignNode).textAlign || '').toLowerCase();
                if (ta.includes('center')) align = 'center';
                else if (ta.includes('right') || ta === 'end') align = 'right';
                else if (ta.includes('justify')) align = 'justify';
                else if (ta.includes('left') || ta === 'start') align = 'left';
                break;
            }
            alignNode = (alignNode as HTMLElement).parentNode as Node | null;
        }
        while (node && node !== editorDiv) {
            if (node.nodeName === 'B' || node.nodeName === 'STRONG') isBold = true;
            if (node.nodeName === 'I' || node.nodeName === 'EM') isItalic = true;
            if (node.nodeName === 'U') isUnderline = true;
            if (node.nodeName === 'CODE') isCode = true;
            if (node.nodeName === 'BLOCKQUOTE') isQuote = true;
            if (node.nodeName === 'H1') isH1 = true;
            if (node.nodeName === 'H2') isH2 = true;
            if (node.nodeName === 'H3') isH3 = true;
            node = node.parentNode as Node | null;
        }
    }

    type ViewPage = {
        id: number;
        title: string;
        is_public: boolean;
        key: string;
        tags: { id: number; name: string }[];
        related?: { id: number; title?: string }[];
    };

    async function loadDocumentForEdit(editId: string) {
        try {
            const resp = await api.get<ViewPage>(`/api/v1/pages/${editId}`);
            const ok = resp.status === 200 || resp.status === 201 || resp.status === 304;
            if (!ok) throw new Error(resp.error || `HTTP ${resp.status}`);
            const data = resp.data as ViewPage;

            title = data.title || title;
            isPublic = !!data.is_public;
            pageTitle.set(title + ' | Система управления заявками ЕИ КФУ');

            selectedTags = (data.tags || []).map(t => ({ id: t.id, name: t.name })) as ServerTagDto[];

            selectedRelated = Array.isArray(data.related)
                ? data.related.map((r) => ({ id: String(r.id), title: r.title ?? String(r.id) }))
                : [];

            const html = await fetchPageContentByKey(isPublic, data.key);
            content = html;
            if (editorDiv) editorDiv.innerHTML = html;
        } catch (e) {
            notification('Не удалось загрузить документ для редактирования', NotificationType.Error);
        }
    }

    async function saveDocument() {
        if (!editorDiv) {
            notification('Редактор не инициализирован', NotificationType.Error);
            return;
        }

        const tagIds = Array.from(new Set(selectedTags.map(t => Number(t.id)).filter(n => Number.isInteger(n) && n > 0)));
        const relatedIds = Array.from(new Set(selectedRelated.map(r => Number(r.id)).filter(n => Number.isInteger(n) && n > 0)));
        
        try {
            const id = await savePageAndGetId({
                html: editorDiv.innerHTML,
                title,
                tags: tagIds,
                related: relatedIds,
                is_public: isPublic
            });
            await goto(`/page/${id}`);
        } catch {
            notification('Ошибка при сохранении документа', NotificationType.Error);
        }
    }

    let userAvatarContainerDesktop: HTMLDivElement | null = null;
    let userAvatarContainerMobile: HTMLDivElement | null = null;
    let userAvatarLoadedDesktop = false;
    let userAvatarLoadedMobile = false;
    let userAvatarLoading = false;

    async function loadUserAvatar() {
        if (!$isAuthenticated || userAvatarLoading) return;
        const u = $currentUser as any;
        if (!u) return;
        userAvatarLoading = true;
        try {
            if (userAvatarContainerDesktop && !userAvatarLoadedDesktop) {
                userAvatarContainerDesktop.innerHTML = '';
                await getAvatar({ ...u, avatar_key: u?.avatar_key ?? null, name: u?.name ?? '' }, userAvatarContainerDesktop, 48, true);
                userAvatarLoadedDesktop = true;
            }
            if (userAvatarContainerMobile && !userAvatarLoadedMobile) {
                userAvatarContainerMobile.innerHTML = '';
                await getAvatar({ ...u, avatar_key: u?.avatar_key ?? null, name: u?.name ?? '' }, userAvatarContainerMobile, 48, true);
                userAvatarLoadedMobile = true;
            }
        } finally {
            userAvatarLoading = false;
        }
    }

    onMount(() => {
        if (!$isAuthenticated || $currentUser === null || $currentUser.role === UserRole.Client) {
            window.location.replace('/error?status=401');
            return;
        }

        const editId = get(pageStore).url.searchParams.get('edit');
        if (editId) {
            void loadDocumentForEdit(editId);
        } else {
            pageTitle.set(title + ' | Система управления заявками ЕИ КФУ');
            if (editorDiv) editorDiv.innerHTML = content;
        }

        document.addEventListener('selectionchange', updateActiveStates);
    });

    $: pageTitle.set(title + ' | Система управления заявками ЕИ КФУ');

    $: if ($isAuthenticated && ((userAvatarContainerDesktop && !userAvatarLoadedDesktop) || (userAvatarContainerMobile && !userAvatarLoadedMobile)) && !userAvatarLoading) {
        void loadUserAvatar();
    }

    onDestroy(() => {
        pageTitle.set('Service Desk | Система управления заявками ЕИ КФУ');
        document.removeEventListener('selectionchange', updateActiveStates);
    });
</script>

<div id="content-panel">
    <header class="editor-header">
        <div class="title-container">
            <button class="back-btn" title="Назад" on:click={ goBack } aria-label="Назад">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M18 22L10 14L18 6" stroke="var(--blue)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="doc-title-block">
                {#if editingTitle}
                    <!-- svelte-ignore a11y_autofocus -->
                    <input
                        class="doc-title-input"
                        bind:value={ title }
                        on:blur={ handleTitleBlur }
                        on:keydown={ handleTitleKeydown }
                        autofocus
                        maxlength="128"
                    />
                {:else}
                    <button type="button" class="doc-title" title="Переименовать" aria-label="Переименовать"
                        on:click={ () => editingTitle = true }
                        on:keydown={ (e) => (e.key === 'Enter' || e.key === ' ') && (editingTitle = true) }
                    >{ title }</button>
                {/if}
            </div>
        </div>
        <div class="header-actions">
            <div class="visibility-control">
                <input id="visibility-switch" type="checkbox" bind:checked={ isPublic } aria-label="Сделать статью публичной" />
                <label for="visibility-switch" class="visibility-label" data-state={ isPublic ? 'public' : 'private' }>
                    <span class="vis-dot" aria-hidden="true"></span>
                    <span>{ isPublic ? 'Публичная' : 'Приватная' }</span>
                </label>
            </div>

            <button class="save-data" title="Сохранить" aria-label="Сохранить" on:click={ saveDocument }>
                <span style="margin-right: 8px">Сохранить</span>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" style="position: relative; top: .1rem;">
                    <path d="M4 4h12l4 4v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="var(--blue)" stroke-width="2" fill="none"/>
                    <path d="M8 4h8v6H8z" stroke="var(--blue)" stroke-width="2" fill="none"/>
                    <path d="M7 18h10" stroke="var(--blue)" stroke-width="2" stroke-linecap="round"/>
                    <rect x="7" y="12" width="4" height="4" stroke="var(--blue)" stroke-width="2" fill="none"/>
                </svg>
            </button>
        </div>
    </header>

    <main>
        <aside class="editor-side">
            <div class="toolbar">
                <div class="toolbar-group">
                    <button type="button" title="Выровнять по левому краю" aria-label="Выровнять по левому краю" class:active={ align === 'left' } on:click={ () => setAlign(editorDiv, 'left', selectionInsideCodeOrQuote, updateActiveStates) }>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <rect x="3" y="5" width="14" height="2" rx="1" fill="currentColor"/>
                            <rect x="3" y="9" width="10" height="2" rx="1" fill="currentColor"/>
                            <rect x="3" y="13" width="14" height="2" rx="1" fill="currentColor"/>
                        </svg>
                    </button>
                    <button type="button" title="Выровнять по центру" aria-label="Выровнять по центру" class:active={ align === 'center' } on:click={ () => setAlign(editorDiv, 'center', selectionInsideCodeOrQuote, updateActiveStates) }>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <rect x="5" y="5" width="10" height="2" rx="1" fill="currentColor"/>
                            <rect x="3" y="9" width="14" height="2" rx="1" fill="currentColor"/>
                            <rect x="5" y="13" width="10" height="2" rx="1" fill="currentColor"/>
                        </svg>
                    </button>
                    <button type="button" title="Выровнять по правому краю" aria-label="Выровнять по правому краю" class:active={ align === 'right' } on:click={ () => setAlign(editorDiv, 'right', selectionInsideCodeOrQuote, updateActiveStates) }>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <rect x="3" y="5" width="14" height="2" rx="1" fill="currentColor"/>
                            <rect x="7" y="9" width="10" height="2" rx="1" fill="currentColor"/>
                            <rect x="3" y="13" width="14" height="2" rx="1" fill="currentColor"/>
                        </svg>
                    </button>
                    <button type="button" title="Выровнять по ширине" aria-label="Выровнять по ширине" class:active={ align === 'justify' } on:click={ () => setAlign(editorDiv, 'justify', selectionInsideCodeOrQuote, updateActiveStates) }>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <rect x="3" y="5" width="14" height="2" rx="1" fill="currentColor"/>
                            <rect x="3" y="9" width="14" height="2" rx="1" fill="currentColor"/>
                            <rect x="3" y="13" width="14" height="2" rx="1" fill="currentColor"/>
                        </svg>
                    </button>
                </div>
                
                <div class="toolbar-group">
                    <button type="button" title="Жирный" aria-label="Жирный" class:active={ isBold } on:click={ () => execCommand(editorDiv, 'bold', undefined, selectionInsideCodeOrQuote, updateActiveStates) }>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <text x="3" y="16" font-size="16" font-weight="bold" fill="currentColor">B</text>
                        </svg>
                    </button>
                    <button type="button" title="Курсив" aria-label="Курсив" class:active={ isItalic } on:click={ () => execCommand(editorDiv, 'italic', undefined, selectionInsideCodeOrQuote, updateActiveStates) }>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <text x="4" y="16" font-size="16" font-style="italic" fill="currentColor">I</text>
                        </svg>
                    </button>
                    <button type="button" title="Подчеркнутый" aria-label="Подчеркнутый" class:active={ isUnderline } on:click={ () => execCommand(editorDiv, 'underline', undefined, selectionInsideCodeOrQuote, updateActiveStates) }>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <text x="4" y="16" font-size="16" fill="currentColor">U</text>
                            <rect x="3" y="18" width="12" height="2" rx="1" fill="currentColor"/>
                        </svg>
                    </button>
                </div>

                <div class="toolbar-group">
                    <button type="button" title="Заголовок 1" aria-label="Заголовок 1" class:active={ isH1 } on:click={() => execCommand(editorDiv, 'formatBlock', '<H1>', selectionInsideCodeOrQuote, updateActiveStates)}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <text x="2" y="16" font-size="16" font-family="Arial" font-weight="bold" fill="currentColor">H1</text>
                        </svg>
                    </button>
                    <button type="button" title="Заголовок 2" aria-label="Заголовок 2" class:active={ isH2 } on:click={() => execCommand(editorDiv, 'formatBlock', '<H2>', selectionInsideCodeOrQuote, updateActiveStates)}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <text x="2" y="16" font-size="16" font-family="Arial" font-weight="bold" fill="currentColor">H2</text>
                        </svg>
                    </button>
                    <button type="button" title="Заголовок 3" aria-label="Заголовок 3" class:active={ isH3 } on:click={() => execCommand(editorDiv, 'formatBlock', '<H3>', selectionInsideCodeOrQuote, updateActiveStates)}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <text x="2" y="16" font-size="16" font-family="Arial" font-weight="bold" fill="currentColor">H3</text>
                        </svg>
                    </button>
                </div>

                <div class="toolbar-group">
                    <button type="button" title="Маркированный список" aria-label="Маркированный список" on:click={ () => insertList(editorDiv, 'ul', selectionInsideCodeOrQuote, updateActiveStates) }>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <circle cx="6" cy="7" r="1.5" fill="currentColor"/>
                            <circle cx="6" cy="12" r="1.5" fill="currentColor"/>
                            <circle cx="6" cy="17" r="1.5" fill="currentColor"/>
                            <rect x="10" y="6" width="7" height="2" rx="1" fill="currentColor"/>
                            <rect x="10" y="11" width="7" height="2" rx="1" fill="currentColor"/>
                            <rect x="10" y="16" width="7" height="2" rx="1" fill="currentColor"/>
                        </svg>
                    </button>
                    <button type="button" title="Нумерованный список" aria-label="Нумерованный список" on:click={ () => insertList(editorDiv, 'ol', selectionInsideCodeOrQuote, updateActiveStates) }>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <text x="4" y="8" font-size="8" fill="currentColor">1</text>
                            <text x="4" y="13" font-size="8" fill="currentColor">2</text>
                            <text x="4" y="18" font-size="8" fill="currentColor">3</text>
                            <rect x="10" y="4" width="7" height="2" rx="1" fill="currentColor"/>
                            <rect x="10" y="9" width="7" height="2" rx="1" fill="currentColor"/>
                            <rect x="10" y="14" width="7" height="2" rx="1" fill="currentColor"/>
                        </svg>
                    </button>
                    <div class="table-menu-wrapper">
                        <button type="button" title="Вставить таблицу" aria-label="Вставить таблицу" on:click={ () => setShowTableMenu(!showTableMenu) }>
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <rect x="3" y="3" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
                                <rect x="3" y="8" width="14" height="2" fill="currentColor"/>
                                <rect x="8" y="3" width="2" height="14" fill="currentColor"/>
                            </svg>
                        </button>
                        {#if showTableMenu}
                            <div class="table-dropdown">
                                <label>
                                    Строк:
                                    <input type="number" min="1" max="10" bind:value={ tableRows } >
                                </label>
                                <label class="ml-10">
                                    Столбцов:
                                    <input type="number" min="1" max="10" bind:value={ tableCols } >
                                </label>
                                <button type="button" class="ml-10" on:click={ () => insertTable(editorDiv, tableRows, tableCols, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu) }>Вставить</button>
                            </div>
                        {/if}
                    </div>
                </div>

                <div class="toolbar-group">
                    <button type="button" title="Цитата" aria-label="Цитата" class:active={ isQuote } on:click={ () => insertBlock(editorDiv, 'blockquote', selectionInsideCodeOrQuote, updateActiveStates, setContent) }>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <text x="3" y="16" font-size="16" fill="currentColor">&ldquo;</text>
                        </svg>
                    </button>
                    <button type="button" title="Код" aria-label="Код" class:active={ isCode } on:click={ () => insertBlock(editorDiv, 'code', selectionInsideCodeOrQuote, updateActiveStates, setContent) }>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <text x="3" y="16" font-size="16" font-family="Arial" font-weight="bold" fill="currentColor">/&gt;</text>
                        </svg>
                    </button>
                </div>

                <div class="toolbar-group">
                    <input type="color" bind:value={ colorPickerValue } title="Выбрать цвет" aria-label="Выбрать цвет" />
                    <button type="button" title="Цвет текста" aria-label="Цвет текста" class="btn-compact" on:click={ () => applyColor(editorDiv, colorPickerValue, selectionInsideCodeOrQuote, updateActiveStates) }>
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                            <text x="8" y="20" font-size="16" font-family="Arial" font-weight="bold" fill="currentColor">A</text>
                            <rect x="7" y="22" width="12" height="2" rx="1" fill={ colorPickerValue }/>
                        </svg>
                    </button>
                    <button type="button" title="Цвет фона" aria-label="Цвет фона" class="btn-compact" on:click={ () => applyBgColor(editorDiv, colorPickerValue, selectionInsideCodeOrQuote, updateActiveStates, setContent) }>
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                            <g transform="rotate(-30 14 14)">
                                <ellipse cx="14" cy="10" rx="6" ry="2" stroke="currentColor" stroke-width="2" fill="none"/>
                                <ellipse cx="14" cy="15.5" rx="5.2" ry="4.2" fill={ colorPickerValue } opacity="0.7"/>
                                <line x1="8" y1="10" x2="10" y2="20" stroke="currentColor" stroke-width="2"/>
                                <line x1="20" y1="10" x2="18" y2="20" stroke="currentColor" stroke-width="2"/>
                                <path d="M10 20 Q14 23 18 20" stroke="currentColor" stroke-width="2" fill="none"/>
                                <ellipse cx="14" cy="21" rx="2.5" ry="1" fill={ colorPickerValue }/>
                            </g>
                        </svg>
                    </button>
                </div>
            </div>

            <section class="metadata-section tags-mobile-hide">
                <div>
                    <Tags
                        bind:selectedTags
                        bind:showTagInput
                        bind:tagQuery
                        { tagSuggestions }
                        { tagLoading }
                        addButtonText="+ Добавить"
                        onToggleMenu={ () => { showTagInput = !showTagInput; tagQuery = ''; tagSuggestions = []; } }
                        { debouncedTagSearch }
                        { handleTagSearch }
                        { addTagFromSuggestion }
                        { removeTag }
                        createTag={ createTag }
                    />
                </div>

                {#if $isAuthenticated && $currentUser}
                    <div class="user-section">
                        <h3>Авторы</h3>
                        <div class="user-item">
                            <div class="avatar-container" bind:this={ userAvatarContainerDesktop }></div>
                            <div class="user-text">
                                <span class="user-name">{ $currentUser.name }</span>
                                <span class="user-status">Вы</span>
                            </div>
                        </div>
                    </div>
                {/if}
            </section>
        </aside>

        <section class="editor-column">
            <div
                id="content"
                class="content-editable doc-area"
                contenteditable="true"
                role="textbox"
                aria-multiline="true"
                tabindex="0"
                bind:this={ editorDiv }
                on:input={ handleEditorInput }
                on:keydown={ handleKeyDown }
                spellcheck="false"
                aria-label={ title }
            >{@html content}</div>

            <section class="metadata-section tags-mobile">
                <div>
                    <Tags
                        bind:selectedTags
                        bind:showTagInput
                        bind:tagQuery
                        { tagSuggestions }
                        { tagLoading }
                        addButtonText="Поиск"
                        addButtonStyle="top: 0"
                        onToggleMenu={ () => { showTagInput = !showTagInput; tagQuery = ''; tagSuggestions = []; } }
                        { debouncedTagSearch }
                        { handleTagSearch }
                        { addTagFromSuggestion }
                        { removeTag }
                        createTag={ createTag }
                    />
                </div>
            </section>

            <section class="related-under-editor">
                <h3>Связанные статьи</h3>
                <div class="related-list">
                    {#if selectedRelated.length === 0}
                        <div class="no-related">Нет связанных статей</div>
                    {/if}
                    {#each selectedRelated as r (r.id)}
                        <div class="related-item">
                            <div class="related-title">{ r.title }</div>
                            <div class="related-actions">
                                <button aria-label="Открыть" title="Открыть" class="meta-related-btn" on:click={ () => window.open(`/articles/${ r.id }`, '_blank') }>
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                        <path d="M14 3h7v7" stroke="var(--dark)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M21 3L10 14" stroke="var(--dark)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                                        <rect x="3.5" y="10.5" width="9.5" height="9" rx="2" stroke="var(--dark)" stroke-width="1.6" fill="none"/>
                                    </svg>
                                </button>
                                <button aria-label="Удалить" title="Удалить" on:click={ () => removeRelated(r.id) } class="meta-related-btn">×</button>
                            </div>
                        </div>
                    {/each}

                    <div class="floating-wrapper small">
                        <button title="Добавить связанную статью" aria-label="Добавить связанную статью" class="meta-add-btn" on:click={ () => { showRelatedInput = !showRelatedInput; relatedQuery = ''; relatedSuggestions = []; } }>+ Добавить</button>

                        {#if showRelatedInput}
                            <div class="floating-menu related-menu">
                                <div class="floating-form">
                                    <!-- svelte-ignore a11y_autofocus -->
                                    <input
                                        type="text"
                                        placeholder="Поиск статьи..."
                                        bind:value={ relatedQuery }
                                        on:input={ () => debouncedRelatedSearch(relatedQuery) }
                                        on:keydown={(e) => { if (e.key === 'Enter') handleRelatedSearch(); }}
                                        aria-label="Поиск связанных статей"
                                        autofocus
                                    />
                                    <button on:click={ handleRelatedSearch } class="meta-add-btn floating-submit">Поиск</button>
                                </div>

                                {#if relatedLoading}
                                    <div class="no-related">Поиск...</div>
                                {:else if relatedSuggestions.length > 0}
                                    <ul class="related-suggestions">
                                        {#each relatedSuggestions as fr (fr.id)}
                                            <li class="related-suggest">
                                                <span>{ fr.title }</span>
                                                <button on:click={ () => addRelated(fr) } class="meta-related-btn">+</button>
                                            </li>
                                        {/each}
                                    </ul>
                                {:else}
                                    <div class="no-related">Ничего не найдено</div>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>
            </section>

            {#if $isAuthenticated && $currentUser}
                <div class="user-section tags-mobile">
                    <h3>Авторы</h3>
                    <div class="user-list">
                        <div class="user-item">
                            <div class="avatar-container" bind:this={ userAvatarContainerMobile }></div>
                            <div class="user-text">
                                <span class="user-name">{ $currentUser.name }</span>
                                <span class="user-status">Вы</span>
                            </div>
                        </div>
                    </div>
                </div>
            {/if}
        </section>
    </main>

    <div style="display:none">
        <blockquote>quote</blockquote>
        <code>code</code>
        <table></table>
    </div>
</div>

<style scoped>
    @import './page.css';
</style>