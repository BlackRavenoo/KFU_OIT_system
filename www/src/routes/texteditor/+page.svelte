<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { pageTitle } from '$lib/utils/setup/stores';
    import { goto } from '$app/navigation';

    import { execCommand, applyColor, applyBgColor, insertList, insertBlock, setAlign } from '$lib/utils/texteditor/text';
    import { serialize, deserialize } from '$lib/utils/texteditor/serialize';
    import { insertTable } from '$lib/utils/texteditor/table';
    import { createHistory, handleEditorInput as handleEditorInputHistory, undo as undoHistory, redo as redoHistory, clearHistoryTimeout } from '$lib/utils/texteditor/history';
    import { notification, NotificationType } from '$lib/utils/notifications/notification';

    let title: string = "Безымянный документ";
    let editingTitle = false;
    let content: string = "";
    let editorDiv: HTMLDivElement | null = null;
    let colorPickerValue: string = "#000000";

    let isBold = false;
    let isItalic = false;
    let isUnderline = false;
    let isCode = false;
    let isQuote = false;
    let align: 'left' | 'center' | 'right' | 'justify' = 'left';

    let showTableMenu = false;
    let tableRows = 2;
    let tableCols = 2;

    let fileInput: HTMLInputElement;

    const historyState = createHistory("");

    let tagsAvailable: string[] = ['meeting', 'spec', 'urgent', 'ui', 'backend'];
    let relatedAvailable: { id: string; title: string }[] = [
        { id: 'p1', title: 'Как настроить интеграцию' },
        { id: 'p2', title: 'Руководство по UI' },
        { id: 'p3', title: 'Частые вопросы' }
    ];

    let selectedTags: string[] = [];
    let selectedRelated: { id: string; title: string }[] = [];

    let showTagInput = false;
    let tagQuery = '';

    let showRelatedInput = false;
    let relatedQuery = '';

    function filteredTags() {
        const q = tagQuery.trim().toLowerCase();
        return tagsAvailable.filter(t => !selectedTags.includes(t) && (!q || t.toLowerCase().includes(q)));
    }

    function filteredRelated() {
        const q = relatedQuery.trim().toLowerCase();
        return relatedAvailable.filter(r => !selectedRelated.find(s => s.id === r.id) && (!q || r.title.toLowerCase().includes(q)));
    }

    function addTag(tag?: string) {
        const t = (tag ?? tagQuery ?? '').trim();
        if (!t) return;
        if (!selectedTags.includes(t)) selectedTags = [...selectedTags, t];
        if (!tagsAvailable.includes(t)) tagsAvailable = [t, ...tagsAvailable];
        tagQuery = '';
        showTagInput = false;
    }

    function removeTag(tag: string) {
        selectedTags = selectedTags.filter(t => t !== tag);
    }

    function addRelated(item?: { id: string; title: string }) {
        if (!item) {
            const newId = `p${Date.now()}`;
            const newItem = { id: newId, title: relatedQuery.trim() || 'Новая статья' };
            relatedAvailable = [newItem, ...relatedAvailable];
            selectedRelated = [...selectedRelated, newItem];
            relatedQuery = '';
            showRelatedInput = false;
            return;
        }
        if (!selectedRelated.find(s => s.id === item.id)) selectedRelated = [...selectedRelated, item];
        relatedQuery = '';
        showRelatedInput = false;
    }

    function removeRelated(id: string) {
        selectedRelated = selectedRelated.filter(r => r.id !== id);
    }

    function setContent(newContent: string) {
        content = newContent;
        if (editorDiv) editorDiv.innerHTML = newContent;
    }

    function setShowTableMenu(show: boolean) {
        showTableMenu = show;
    }

    function handleEditorInput() {
        updateActiveStates();
        content = editorDiv?.innerHTML ?? "";
        handleEditorInputHistory(historyState, content);
    }

    function undo() {
        undoHistory(historyState, setContent, updateActiveStates);
    }

    function redo() {
        redoHistory(historyState, setContent, updateActiveStates);
    }

    function handleTitleBlur() {
        editingTitle = false;
        if (!title.trim()) title = "Безымянный документ";
    }

    function handleTitleKeydown(e: KeyboardEvent) {
        (e.key === "Enter" || e.key === "Escape") && (e.target as HTMLInputElement).blur();
    }

    function goBack() {
        goto('/');
    }

    function handleTab(e: KeyboardEvent) {
        if (e.key === "Tab") {
            e.preventDefault();
            if (!editorDiv) return;
            if (selectionInsideCodeOrQuote()) return;
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            const range = selection.getRangeAt(0);

            const tabNode = document.createTextNode("    ");
            range.deleteContents();
            range.insertNode(tabNode);

            range.setStartAfter(tabNode);
            range.setEndAfter(tabNode);

            selection.removeAllRanges();
            selection.addRange(range);

            content = editorDiv.innerHTML;
            updateActiveStates();
        }
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (!editorDiv) return;
        e.stopPropagation();
        if (e.key === "Tab") {
            handleTab(e);
            return;
        }
    }

    function selectionInsideCodeOrQuote(): boolean {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return false;
        let node: Node | null = selection.anchorNode;
        while (node && node !== editorDiv) {
            if (
                node.nodeName === 'CODE' ||
                node.nodeName === 'BLOCKQUOTE'
            ) return true;
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
        align = 'left';

        let alignNode = node;
        while (alignNode && alignNode !== editorDiv) {
            if (
                alignNode instanceof HTMLElement &&
                /^(P|DIV|LI|BLOCKQUOTE|H1|H2|H3|H4|H5|H6|TD|TH)$/i.test(alignNode.nodeName)
            ) {
                const style = window.getComputedStyle(alignNode);
                if (style.textAlign === 'center') align = 'center';
                else if (style.textAlign === 'right') align = 'right';
                else if (style.textAlign === 'justify') align = 'justify';
                else align = 'left';
                break;
            }
            alignNode = alignNode.parentNode as Node | null;
        }

        while (node && node !== editorDiv) {
            if (node.nodeName === 'B' || node.nodeName === 'STRONG') isBold = true;
            if (node.nodeName === 'I' || node.nodeName === 'EM') isItalic = true;
            if (node.nodeName === 'U') isUnderline = true;
            if (node.nodeName === 'CODE') isCode = true;
            if (node.nodeName === 'BLOCKQUOTE') isQuote = true;
            node = node.parentNode as Node | null;
        }
    }

    function downloadJSON() {
        if (!editorDiv) {
            notification('Редактор не инициализирован', NotificationType.Error);
            return;
        }

        try {
            const serializedData = serialize(editorDiv.innerHTML);
            const blob = new Blob([JSON.stringify({ serializedData }, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');

            a.href = url;
            a.download = `${title.replace(/[^a-zа-яё0-9]/gi, '_')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            notification('Файл успешно скачан', NotificationType.Success);
        } catch (error) {
            console.error('Ошибка при скачивании:', error);
            notification('Ошибка при скачивании файла', NotificationType.Error);
        }
    }

    function openFileDialog() {
        fileInput?.click();
    }

    function handleFileUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];

        if (!file) return;

        if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
            notification('Пожалуйста, выберите JSON файл', NotificationType.Warning);
            input.value = '';
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const jsonText = e.target?.result as string;
                const data = JSON.parse(jsonText);

                if (!data.serializedData || !Array.isArray(data.serializedData)) {
                    notification('Неверный формат файла', NotificationType.Error);
                    return;
                }

                if (data.title && typeof data.title === 'string')
                    title = data.title;

                const html = deserialize(data.serializedData);
                setContent(html);

                handleEditorInputHistory(historyState, html);

                notification('Файл успешно загружен', NotificationType.Success);
            } catch (error) {
                console.error('Ошибка при загрузке файла:', error);
                notification('Ошибка при чтении файла', NotificationType.Error);
            } finally {
                input.value = '';
            }
        };

        reader.onerror = (e) => {
            notification('Ошибка при чтении файла', NotificationType.Error);
            input.value = '';
        };

        reader.readAsText(file);
    }

    async function sendToServer() {
        if (!editorDiv) {
            notification('Редактор не инициализирован', NotificationType.Error);
            return;
        }
        try {
            const serializedData = serialize(editorDiv.innerHTML);
            const jsonData = {
                data: serializedData,
                title: title,
                tags: selectedTags,
                related: selectedRelated.map(r => r.id),
                is_public: true
            };
            const response = await fetch('/api/v1/pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jsonData)
            });
            response.ok
                ? notification('Документ успешно отправлен', NotificationType.Success)
                : notification('Ошибка при отправке документа', NotificationType.Error);
        } catch (error) {
            notification('Ошибка при отправке документа', NotificationType.Error);
        }
    };

    onMount(() => {
        pageTitle.set(title + ' | Система управления заявками ЕИ КФУ');
        if (editorDiv) 
            editorDiv.innerHTML = content;

        document.addEventListener('selectionchange', updateActiveStates);
    });

    $: pageTitle.set(title + ' | Система управления заявками ЕИ КФУ');

    onDestroy(() => {
        pageTitle.set('ОИТ | Система управления заявками ЕИ КФУ');
        document.removeEventListener('selectionchange', updateActiveStates);
        clearHistoryTimeout(historyState);
    });
</script>

<div id="content-panel">
    <header class="editor-header">
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
                    on:keydown={ (e) => (e.key === "Enter" || e.key === " ") && (editingTitle = true) }
                >{ title }</button>
            {/if}
        </div>

        <div class="header-actions">
            <button title="Скачать" aria-label="Скачать" on:click={ downloadJSON }>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3v10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 12l7 7 7-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button title="Отправить" aria-label="Отправить" on:click={ sendToServer }>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 2l-7 20  -3-9-9-1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button title="Загрузить" aria-label="Загрузить" on:click={ openFileDialog }>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3v10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 12h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
        </div>
    </header>

    <main>
        <aside class="editor-side">
            <div class="toolbar">
                <div class="toolbar-group">
                    {#if historyState.historyIndex > 0}
                        <button type="button" title="Назад по истории" aria-label="Назад по истории" on:click={ undo }>
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M7 10L13 4V8H17V12H13V16L7 10Z" fill="currentColor"/>
                            </svg>
                        </button>
                    {/if}
                    {#if historyState.historyIndex < historyState.history.length - 1}
                        <button type="button" title="Вперёд по истории" aria-label="Вперёд по истории" on:click={ redo }>
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M13 10L7 16V12H3V8H7V4L13 10Z" fill="currentColor"/>
                            </svg>
                        </button>
                    {/if}
                </div>

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
                    <button type="button" title="Заголовок 1" aria-label="Заголовок 1" on:click={() => execCommand(editorDiv, 'formatBlock', '<H1>', selectionInsideCodeOrQuote, updateActiveStates)}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <text x="2" y="16" font-size="16" font-family="Arial" font-weight="bold" fill="currentColor">H1</text>
                        </svg>
                    </button>
                    <button type="button" title="Заголовок 2" aria-label="Заголовок 2" on:click={() => execCommand(editorDiv, 'formatBlock', '<H2>', selectionInsideCodeOrQuote, updateActiveStates)}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <text x="2" y="16" font-size="16" font-family="Arial" font-weight="bold" fill="currentColor">H2</text>
                        </svg>
                    </button>
                    <button type="button" title="Заголовок 3" aria-label="Заголовок 3" on:click={() => execCommand(editorDiv, 'formatBlock', '<H3>', selectionInsideCodeOrQuote, updateActiveStates)}>
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

            <section class="metadata-section">
                <div>
                    <h3>Тэги</h3>
                    <div class="tag-container">
                        {#each selectedTags as tag (tag)}
                            <button class="tag-btn" on:click={ () => removeTag(tag) }>{ tag } ×</button>
                        {/each}

                        <div class="floating-wrapper">
                            <button title="Добавить тэг" aria-label="Добавить тэг" class="meta-add-btn" on:click={ () => { showTagInput = !showTagInput; tagQuery = ''; } }>+ Добавить</button>

                            {#if showTagInput}
                                <div class="floating-menu tag-menu">
                                    <div class="floating-form">
                                        <!-- svelte-ignore a11y_autofocus -->
                                        <input
                                            type="text"
                                            placeholder="Поиск или создать тэг..."
                                            bind:value={ tagQuery }
                                            on:keydown={(e) => { if (e.key === 'Enter') addTag(); }}
                                            aria-label="Поиск тэгов"
                                            autofocus
                                        />
                                        <button on:click={ () => addTag() } class="meta-add-btn" style="top: -.5rem; padding: 6px 25px;">Добавить</button>
                                    </div>

                                    {#if filteredTags().length > 0}
                                        <ul class="tag-suggestions">
                                            {#each filteredTags() as ft}
                                                <li><button class="meta-add-btn meta-suggest-btn" on:click={ () => addTag(ft) }>{ ft }</button></li>
                                            {/each}
                                        </ul>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>

                <div class="related-container">
                    <h3>Связанные статьи</h3>
                    <div class="related-list">
                        {#if selectedRelated.length === 0}
                            <div class="no-related">Нет связанных статей</div>
                        {/if}
                        {#each selectedRelated as r (r.id)}
                            <div class="related-item">
                                <div class="related-title">{ r.title }</div>
                                <div class="related-actions">
                                    <button aria-label="Удалить" title="Удалить" on:click={ () => removeRelated(r.id) } class="meta-related-btn">×</button>
                                </div>
                            </div>
                        {/each}

                        <div class="floating-wrapper small">
                            <button title="Добавить связанную статью" aria-label="Добавить связанную статью" class="meta-add-btn" on:click={ () => { showRelatedInput = !showRelatedInput; relatedQuery = ''; } }>+ Добавить</button>

                            {#if showRelatedInput}
                                <div class="floating-menu related-menu">
                                    <div class="floating-form">
                                        <!-- svelte-ignore a11y_autofocus -->
                                        <input
                                            type="text"
                                            placeholder="Поиск статьи..."
                                            bind:value={ relatedQuery }
                                            on:keydown={(e) => { if (e.key === 'Enter') { if (filteredRelated()[0]) addRelated(filteredRelated()[0]); else addRelated(); } }}
                                            aria-label="Поиск связанных статей"
                                            autofocus
                                        />
                                        <button on:click={() => { if (filteredRelated()[0]) addRelated(filteredRelated()[0]); else addRelated(); }} class="meta-add-btn" style="top: -.5rem; padding: 6px 25px;">Добавить</button>
                                    </div>

                                    {#if filteredRelated().length > 0}
                                        <ul class="related-suggestions">
                                            {#each filteredRelated() as fr}
                                                <li class="related-suggest">
                                                    <span>{ fr.title }</span>
                                                    <button on:click={ () => addRelated(fr) } class="meta-related-btn">+</button>
                                                </li>
                                            {/each}
                                        </ul>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            </section>
        </aside>

        <section style="flex:1 1 auto; min-width:0;">
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
            >{ @html content }</div>
        </section>
    </main>

    <div style="display:none">
        <blockquote>quote</blockquote>
        <code>code</code>
        <table></table>
    </div>
</div>

<input
    type="file"
    accept="application/json,.json"
    bind:this={ fileInput }
    on:change={ handleFileUpload }
    style="display: none;"
    aria-hidden="true"
/>

<style scoped>
    @import './page.css';
</style>