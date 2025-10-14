<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { pageTitle } from '$lib/utils/setup/stores';
    import { goto } from '$app/navigation';

    let title: string = "Безымянный документ";
    let editingTitle = false;
    let content: string = "";
    let editorDiv: HTMLDivElement | null = null;
    let colorPickerValue: string = "#000000";

    function execCommand(command: string, value?: string) {
        if (!editorDiv) return;
        editorDiv.focus();
        document.execCommand(command, false, value);
        content = editorDiv.innerHTML;
    }

    function applyColor() {
        if (!editorDiv) return;
        editorDiv.focus();
        document.execCommand('styleWithCSS', false, 'true');
        document.execCommand('foreColor', false, colorPickerValue);
        content = editorDiv.innerHTML;
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
        content = editorDiv.innerHTML;
    }

    function insertList(type: 'ol' | 'ul') {
        if (!editorDiv) return;
        editorDiv.focus();
        document.execCommand(type === 'ol' ? 'insertOrderedList' : 'insertUnorderedList');
        content = editorDiv.innerHTML;
    }

    function insertQuote() {
        wrapSelection('blockquote');
    }

    function insertHeader(level: number) {
        if (!editorDiv) return;
        editorDiv.focus();
        document.execCommand('formatBlock', false, 'H' + level);
        content = editorDiv.innerHTML;
    }

    function handleTitleBlur() {
        editingTitle = false;
        if (!title.trim()) title = "Безымянный документ";
    }

    function handleTitleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" || e.key === "Escape") {
            (e.target as HTMLInputElement).blur();
        }
    }

    function goBack() {
        goto('/');
    }

    onMount(() => {
        pageTitle.set(title + ' | Система управления заявками ЕИ КФУ');
        if (editorDiv) editorDiv.innerHTML = content;
    });

    $: pageTitle.set(title + ' | Система управления заявками ЕИ КФУ');

    onDestroy(() => {
        pageTitle.set('ОИТ | Система управления заявками ЕИ КФУ');
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
                <input
                    class="doc-title-input"
                    bind:value={ title }
                    on:blur={ handleTitleBlur }
                    on:keydown={ handleTitleKeydown }
                    autofocus
                    maxlength="128"
                />
            {:else}
                <span class="doc-title" title="Переименовать" tabindex="0"
                    on:click={ () => editingTitle = true }
                    on:keydown={ (e) => (e.key === "Enter" || e.key === " ") && (editingTitle = true) }
                >{ title }</span>
            {/if}
        </div>
        <div class="toolbar">
            <div class="toolbar-group">
                <button type="button" title="Жирный" on:click={ () => execCommand('bold') }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <text x="3" y="16" font-size="16" font-weight="bold" fill="currentColor">B</text>
                    </svg>
                </button>
                <button type="button" title="Курсив" on:click={ () => execCommand('italic') }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <text x="4" y="16" font-size="16" font-style="italic" fill="currentColor">I</text>
                    </svg>
                </button>
                <button type="button" title="Цитата" on:click={ insertQuote }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <text x="3" y="16" font-size="16" fill="currentColor">&ldquo;</text>
                    </svg>
                </button>
            </div>
            <div class="toolbar-group">
                <button type="button" title="Заголовок 1" on:click={ () => insertHeader(1) }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <text x="2" y="16" font-size="16" font-weight="bold" fill="currentColor">H</text>
                        <text x="13" y="16" font-size="12" fill="currentColor">1</text>
                    </svg>
                </button>
                <button type="button" title="Заголовок 2" on:click={ () => insertHeader(2) }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <text x="2" y="16" font-size="16" font-weight="bold" fill="currentColor">H</text>
                        <text x="13" y="16" font-size="12" fill="currentColor">2</text>
                    </svg>
                </button>
                <button type="button" title="Заголовок 3" on:click={ () => insertHeader(3) }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <text x="2" y="16" font-size="16" font-weight="bold" fill="currentColor">H</text>
                        <text x="13" y="16" font-size="12" fill="currentColor">3</text>
                    </svg>
                </button>
            </div>
            <div class="toolbar-group">
                <button type="button" title="Нумерованный список" on:click={ () => insertList('ol') }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="6" cy="10" r="2" fill="currentColor"/>
                        <rect x="10" y="8.5" width="7" height="3" rx="1.5" fill="currentColor"/>
                    </svg>
                </button>
                <button type="button" title="Маркированный список" on:click={ () => insertList('ul') }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="6" cy="7" r="1.5" fill="currentColor"/>
                        <circle cx="6" cy="13" r="1.5" fill="currentColor"/>
                        <rect x="10" y="5.5" width="7" height="3" rx="1.5" fill="currentColor"/>
                        <rect x="10" y="11.5" width="7" height="3" rx="1.5" fill="currentColor"/>
                    </svg>
                </button>
            </div>
            <div class="toolbar-group">
                <input type="color" bind:value={ colorPickerValue } title="Выбрать цвет">
                <button type="button" title="Покрасить" on:click={ applyColor }>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2"/>
                        <circle cx="10" cy="10" r="4" fill={ colorPickerValue }/>
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
            bind:this={ editorDiv }
            on:input={ () => content = editorDiv?.innerHTML || "" }
            spellcheck="true"
        >{ @html content }</div>
    </main>
</div>

<style>
    @import './page.css';
</style>