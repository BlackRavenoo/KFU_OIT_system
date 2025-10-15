<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { pageTitle } from '$lib/utils/setup/stores';
    import { goto } from '$app/navigation';

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

    function execCommand(command: string, value?: string) {
        if (!editorDiv) return;
        editorDiv.focus();
        document.execCommand(command, false, value);
        updateActiveStates();
    }

    function applyColor() {
        if (!editorDiv) return;
        editorDiv.focus();
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand('foreColor', false, colorPickerValue);
        updateActiveStates();
    }

    function applyBgColor() {
        if (!editorDiv) return;
        editorDiv.focus();
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand('backColor', false, colorPickerValue);
        updateActiveStates();
    }

    function wrapSelection(tag: string, style?: string) {
        if (!editorDiv) return;
        editorDiv.focus();
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        const el = document.createElement(tag);
        if (style) el.setAttribute('style', style);
        range.surroundContents(el);
        updateActiveStates();
    }

    function insertList(type: 'ol' | 'ul') {
        if (!editorDiv) return;
        editorDiv.focus();
        document.execCommand(type === 'ol' ? 'insertOrderedList' : 'insertUnorderedList');
        updateActiveStates();
    }

    function insertQuote() {
        wrapSelection('blockquote');
    }

    function insertCodeBlock() {
        if (!editorDiv) return;
        editorDiv.focus();
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        const el = document.createElement('code');
        range.surroundContents(el);
        updateActiveStates();
    }

    function setAlign(type: 'left' | 'center' | 'right' | 'justify') {
        if (!editorDiv) return;
        editorDiv.focus();
        let cmd = '';
        switch (type) {
            case 'left': cmd = 'justifyLeft'; break;
            case 'center': cmd = 'justifyCenter'; break;
            case 'right': cmd = 'justifyRight'; break;
            case 'justify': cmd = 'justifyFull'; break;
        }
        document.execCommand(cmd, false, undefined);
        updateActiveStates();
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
        if (e.key === "Tab") {
            handleTab(e);
            return;
        }

        if (e.key === "Enter") {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                let node: Node | null = range.startContainer;
                let heading: HTMLElement | null = null;
                while (node && node !== editorDiv) {
                    if (
                        node.nodeType === Node.ELEMENT_NODE &&
                        /^(H1|H2|H3)$/i.test((node as HTMLElement).tagName)
                    ) {
                        heading = node as HTMLElement;
                        break;
                    }
                    node = node.parentNode as Node | null;
                }
                if (heading) {
                    e.preventDefault();
                    const p = document.createElement('p');
                    p.innerHTML = '<br>';
                    heading.nextSibling ?
                        heading.parentNode?.insertBefore(p, heading.nextSibling) :
                        heading.parentNode?.appendChild(p);

                    const sel = window.getSelection();
                    if (sel) {
                        sel.removeAllRanges();
                        const newRange = document.createRange();
                        newRange.setStart(p, 0);
                        newRange.collapse(true);
                        sel.addRange(newRange);
                    }
                    content = editorDiv.innerHTML;
                    updateActiveStates();
                    return;
                }
            }
            e.preventDefault();
            document.execCommand('insertHTML', false, '<br><br>');
        }
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

    function handleSelectionChange() {
        updateActiveStates();
    }

    onMount(() => {
        pageTitle.set(title + ' | Система управления заявками ЕИ КФУ');
        if (editorDiv) {
            editorDiv.innerHTML = content;
        }
        document.addEventListener('selectionchange', handleSelectionChange);
    });

    $: pageTitle.set(title + ' | Система управления заявками ЕИ КФУ');

    onDestroy(() => {
        pageTitle.set('ОИТ | Система управления заявками ЕИ КФУ');
        document.removeEventListener('selectionchange', handleSelectionChange);
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
        <div class="toolbar">
            <div class="toolbar-group">
                <button type="button" title="Жирный" aria-label="Жирный" class:active={ isBold } on:click={ () => execCommand('bold') }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <text x="3" y="16" font-size="16" font-weight="bold" fill="currentColor">B</text>
                    </svg>
                </button>
                <button type="button" title="Курсив" aria-label="Курсив" class:active={ isItalic } on:click={ () => execCommand('italic') }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <text x="4" y="16" font-size="16" font-style="italic" fill="currentColor">I</text>
                    </svg>
                </button>
                <button type="button" title="Подчеркнутый" aria-label="Подчеркнутый" class:active={ isUnderline } on:click={ () => execCommand('underline') }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <text x="4" y="16" font-size="16" fill="currentColor">U</text>
                        <rect x="3" y="18" width="12" height="2" rx="1" fill="currentColor"/>
                    </svg>
                </button>
            </div>
            <div class="toolbar-group">
                <button type="button" title="Заголовок 1" aria-label="Заголовок 1" on:click={() => execCommand('formatBlock', '<H1>')}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <text x="2" y="16" font-size="16" font-family="Arial" font-weight="bold" fill="currentColor">H1</text>
                    </svg>
                </button>
                <button type="button" title="Заголовок 2" aria-label="Заголовок 2" on:click={() => execCommand('formatBlock', '<H2>')}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <text x="2" y="16" font-size="16" font-family="Arial" font-weight="bold" fill="currentColor">H2</text>
                    </svg>
                </button>
                <button type="button" title="Заголовок 3" aria-label="Заголовок 3" on:click={() => execCommand('formatBlock', '<H3>')}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <text x="2" y="16" font-size="16" font-family="Arial" font-weight="bold" fill="currentColor">H3</text>
                    </svg>
                </button>
            </div>
            <div class="toolbar-group">
                <button type="button" title="Цитата" aria-label="Цитата" class:active={ isQuote } on:click={ insertQuote }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <text x="3" y="16" font-size="16" fill="currentColor">&ldquo;</text>
                    </svg>
                </button>
                <button type="button" title="Код" aria-label="Код" class:active={ isCode } on:click={ insertCodeBlock }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <text x="3" y="16" font-size="16" font-family="Arial" font-weight="bold" fill="currentColor">/&gt;</text>
                    </svg>
                </button>
            </div>
            <div class="toolbar-group">
                <button type="button" title="Маркированный список" aria-label="Маркированный список" on:click={ () => insertList('ul') }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="6" cy="7" r="1.5" fill="currentColor"/>
                        <circle cx="6" cy="12" r="1.5" fill="currentColor"/>
                        <circle cx="6" cy="17" r="1.5" fill="currentColor"/>
                        <rect x="10" y="6" width="7" height="2" rx="1" fill="currentColor"/>
                        <rect x="10" y="11" width="7" height="2" rx="1" fill="currentColor"/>
                        <rect x="10" y="16" width="7" height="2" rx="1" fill="currentColor"/>
                    </svg>
                </button>
                <button type="button" title="Нумерованный список" aria-label="Нумерованный список" on:click={ () => insertList('ol') }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <text x="4" y="8" font-size="8" fill="currentColor">1.</text>
                        <text x="4" y="13" font-size="8" fill="currentColor">2.</text>
                        <text x="4" y="18" font-size="8" fill="currentColor">3.</text>
                        <rect x="10" y="6" width="7" height="2" rx="1" fill="currentColor"/>
                        <rect x="10" y="11" width="7" height="2" rx="1" fill="currentColor"/>
                        <rect x="10" y="16" width="7" height="2" rx="1" fill="currentColor"/>
                    </svg>
                </button>
            </div>
            <div class="toolbar-group">
                <button type="button" title="Выровнять по левому краю" aria-label="Выровнять по левому краю" class:active={ align === 'left' } on:click={ () => setAlign('left') }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <rect x="3" y="5" width="14" height="2" rx="1" fill="currentColor"/>
                        <rect x="3" y="9" width="10" height="2" rx="1" fill="currentColor"/>
                        <rect x="3" y="13" width="14" height="2" rx="1" fill="currentColor"/>
                    </svg>
                </button>
                <button type="button" title="Выровнять по центру" aria-label="Выровнять по центру" class:active={ align === 'center' } on:click={ () => setAlign('center') }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <rect x="5" y="5" width="10" height="2" rx="1" fill="currentColor"/>
                        <rect x="3" y="9" width="14" height="2" rx="1" fill="currentColor"/>
                        <rect x="5" y="13" width="10" height="2" rx="1" fill="currentColor"/>
                    </svg>
                </button>
                <button type="button" title="Выровнять по правому краю" aria-label="Выровнять по правому краю" class:active={ align === 'right' } on:click={ () => setAlign('right') }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <rect x="3" y="5" width="14" height="2" rx="1" fill="currentColor"/>
                        <rect x="7" y="9" width="10" height="2" rx="1" fill="currentColor"/>
                        <rect x="3" y="13" width="14" height="2" rx="1" fill="currentColor"/>
                    </svg>
                </button>
                <button type="button" title="Выровнять по ширине" aria-label="Выровнять по ширине" class:active={ align === 'justify' } on:click={ () => setAlign('justify') }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <rect x="3" y="5" width="14" height="2" rx="1" fill="currentColor"/>
                        <rect x="3" y="9" width="14" height="2" rx="1" fill="currentColor"/>
                        <rect x="3" y="13" width="14" height="2" rx="1" fill="currentColor"/>
                    </svg>
                </button>
            </div>
            <div class="toolbar-group">
                <input type="color" bind:value={ colorPickerValue } title="Выбрать цвет" aria-label="Выбрать цвет">
                <button type="button" title="Цвет текста" aria-label="Цвет текста" on:click={ applyColor } style="padding: 0 6px;">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <text x="8" y="20" font-size="16" font-family="Arial" font-weight="bold" fill="currentColor">A</text>
                        <rect x="7" y="22" width="12" height="2" rx="1" fill={ colorPickerValue }/>
                    </svg>
                </button>
                <button type="button" title="Цвет фона" aria-label="Цвет фона" on:click={ applyBgColor } style="padding: 0 6px;">
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
    </header>
    <main>
        <div
            id="content"
            class="content-editable doc-area"
            contenteditable="true"
            role="textbox"
            aria-multiline="true"
            tabindex="0"
            bind:this={ editorDiv }
            on:input={() => {
                updateActiveStates();
                content = editorDiv?.innerHTML ?? "";
            }}
            on:keydown={ handleKeyDown }
            spellcheck="true"
            aria-label={ title }
        >{ @html content }</div>
    </main>
</div>

<style>
    @import './page.css';
</style>