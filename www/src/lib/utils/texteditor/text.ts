/**
 * Выполняет команду форматирования текста
 * @param editorDiv - DOM-элемент редактируемой области
 * @param command - Команда execCommand
 * @param value - Значение для команды (опционально)
 * @param selectionInsideCodeOrQuote - Функция, возвращающая true, если курсор внутри code/blockquote
 * @param updateActiveStates - Функция для обновления состояния панели инструментов
 */
export function execCommand(
    editorDiv: HTMLDivElement | null,
    command: string,
    value: string | undefined,
    selectionInsideCodeOrQuote: () => boolean,
    updateActiveStates: () => void
) {
    if (!editorDiv) return;
    if (selectionInsideCodeOrQuote()) return;
    editorDiv.focus();
    document.execCommand(command, false, value);
    updateActiveStates();
}

/**
 * Применяет цвет текста к выделенному фрагменту
 * @param {HTMLDivElement} editorDiv - DOM-элемент редактируемой области
 * @param {string} color - Цвет в формате CSS
 * @param {() => boolean} selectionInsideCodeOrQuote - Функция, возвращающая true, если курсор внутри code/blockquote
 * @param {() => void} updateActiveStates - Функция для обновления состояния панели инструментов
 */
export function applyColor(
    editorDiv: HTMLDivElement | null,
    color: string,
    selectionInsideCodeOrQuote: () => boolean,
    updateActiveStates: () => void
) {
    if (!editorDiv) return;
    if (selectionInsideCodeOrQuote()) return;
    editorDiv.focus();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('foreColor', false, color);
    updateActiveStates();
}

/**
 * Применяет цвет фона к выделенному фрагменту или ячейкам таблицы
 * @param {HTMLDivElement} editorDiv - DOM-элемент редактируемой области
 * @param {string} color - Цвет в формате CSS
 * @param {() => boolean} selectionInsideCodeOrQuote - Функция, возвращающая true, если курсор внутри code/blockquote
 * @param {() => void} updateActiveStates - Функция для обновления состояния панели инструментов
 * @param {(content: string) => void} setContent - Функция для обновления контента редактора
 */
export function applyBgColor(
    editorDiv: HTMLDivElement | null,
    color: string,
    selectionInsideCodeOrQuote: () => boolean,
    updateActiveStates: () => void,
    setContent: (content: string) => void
) {
    if (!editorDiv) return;
    if (selectionInsideCodeOrQuote()) return;
    editorDiv.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    let cells: HTMLElement[] = [];
    for (let i = 0; i < selection.rangeCount; i++) {
        const r = selection.getRangeAt(i);
        const common = r.commonAncestorContainer;
        let nodeList: NodeListOf<HTMLElement> | HTMLElement[] = [];
        nodeList = common.nodeType === Node.ELEMENT_NODE ? (common as HTMLElement).querySelectorAll('td,th') : [];
        nodeList.forEach(cell => {
            const cellRange = document.createRange();
            cellRange.selectNodeContents(cell);
            if (
                (r.compareBoundaryPoints(Range.END_TO_START, cellRange) < 0 &&
                 r.compareBoundaryPoints(Range.START_TO_END, cellRange) > 0) ||
                r.intersectsNode(cell)
            ) {
                cells.push(cell);
            }
        });
    }

    if (cells.length > 0) {
        cells = Array.from(new Set(cells));
        cells.forEach(cell => {
            cell.style.backgroundColor = color;
        });
        setContent(editorDiv.innerHTML);
        updateActiveStates();
        return;
    }

    let node = selection.anchorNode as HTMLElement | null;
    while (node && node !== editorDiv) {
        if (node.nodeType === Node.ELEMENT_NODE && (node.nodeName === 'TD' || node.nodeName === 'TH')) {
            (node as HTMLElement).style.backgroundColor = color;
            setContent(editorDiv.innerHTML);
            updateActiveStates();
            return;
        }
        node = node.parentElement;
    }
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('backColor', false, color);
    updateActiveStates();
}

/**
 * Вставляет маркированный или нумерованный список
 * @param {HTMLDivElement} editorDiv - DOM-элемент редактируемой области
 * @param {'ol' | 'ul'} type - Тип списка
 * @param {() => boolean} selectionInsideCodeOrQuote - Функция, возвращающая true, если курсор внутри code/blockquote
 * @param {() => void} updateActiveStates - Функция для обновления состояния панели инструментов
 */
export function insertList(
    editorDiv: HTMLDivElement | null,
    type: 'ol' | 'ul',
    selectionInsideCodeOrQuote: () => boolean,
    updateActiveStates: () => void
) {
    if (!editorDiv) return;
    if (selectionInsideCodeOrQuote()) return;
    editorDiv.focus();
    document.execCommand(type === 'ol' ? 'insertOrderedList' : 'insertUnorderedList');
    updateActiveStates();
}

/**
 * Очищает HTML от тегов и стилей
 * @param {string} html - Входящая HTML-строка
 * @returns {string} Очищенный текст
 */
export function stripTagsAndStyles(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

/**
 * Вставляет блок цитаты или кода
 * @param {HTMLDivElement} editorDiv - DOM-элемент редактируемой области
 * @param {'blockquote' | 'code'} type - Тип блока
 * @param {() => boolean} selectionInsideCodeOrQuote - Функция, возвращающая true, если курсор внутри code/blockquote
 * @param {() => void} updateActiveStates - Функция для обновления состояния панели инструментов
 * @param {(content: string) => void} setContent - Функция для обновления контента редактора
 */
export function insertBlock(
    editorDiv: HTMLDivElement | null,
    type: 'blockquote' | 'code',
    selectionInsideCodeOrQuote: () => boolean,
    updateActiveStates: () => void,
    setContent: (content: string) => void
) {
    if (!editorDiv) return;
    if (selectionInsideCodeOrQuote()) return;
    editorDiv.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    const fragment = range.cloneContents();
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(fragment);
    const cleanText = stripTagsAndStyles(tempDiv.innerHTML);

    const block = document.createElement(type);
    block.textContent = cleanText;
    range.deleteContents();
    range.insertNode(block);

    range.setStartAfter(block);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    updateActiveStates();
    setContent(editorDiv.innerHTML);
}

/**
 * Устанавливает выравнивание текста
 * @param {HTMLDivElement} editorDiv - DOM-элемент редактируемой области
 * @param {'left' | 'center' | 'right' | 'justify'} type - Тип выравнивания
 * @param {() => boolean} selectionInsideCodeOrQuote - Функция, возвращающая true, если курсор внутри code/blockquote
 * @param {() => void} updateActiveStates - Функция для обновления состояния панели инструментов
 */
export function setAlign(
    editorDiv: HTMLDivElement | null,
    type: 'left' | 'center' | 'right' | 'justify',
    selectionInsideCodeOrQuote: () => boolean,
    updateActiveStates: () => void
) {
    if (!editorDiv) return;
    if (selectionInsideCodeOrQuote()) return;
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

function escapeHtml(input: string): string {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isImageLink(url: string): boolean {
    return /\.(jpe?g|jpd|png|webp)(?:$|[?#])/i.test(url.trim());
}

function getRutubeVideoId(url: string): string | null {
    try {
        const parsed = new URL(url.trim());
        const host = parsed.hostname.toLowerCase();
        if (!(host === 'rutube.ru' || host.endsWith('.rutube.ru'))) return null;

        const parts = parsed.pathname.split('/').filter(Boolean);
        const videoIdx = parts.indexOf('video');
        if (videoIdx !== -1 && parts[videoIdx + 1]) return parts[videoIdx + 1];
        const embedIdx = parts.indexOf('embed');
        if (embedIdx !== -1 && parts[embedIdx + 1]) return parts[embedIdx + 1];
        return parts.length > 0 ? parts[parts.length - 1] : null;
    } catch {
        return null;
    }
}

function createEmbedElement(kind: 'image' | 'rutube', href: string, linkId: string, label: string): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = `te-generated-embed te-generated-embed-${kind}`;
    wrap.setAttribute('contenteditable', 'false');
    wrap.dataset.mdEmbedOwner = linkId;

    if (kind === 'image') {
        const img = document.createElement('img');
        img.src = href;
        img.alt = label;
        img.loading = 'lazy';
        wrap.appendChild(img);
    } else {
        const rutubeId = getRutubeVideoId(href);
        const iframe = document.createElement('iframe');
        iframe.src = `https://rutube.ru/play/embed/${encodeURIComponent(rutubeId ?? '')}`;
        iframe.loading = 'lazy';
        iframe.allowFullscreen = true;
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
        wrap.appendChild(iframe);
    }

    return wrap;
}

let generatedCounter = 0;

/**
 * Преобразует markdown-ссылки в редакторе:
 * - [text](url) => обычная ссылка
 * - [text](url)! и ![alt](url) => ссылка + автогенерируемый embed (картинка/rutube)
 *
 * Embed нельзя удалить напрямую: при каждом вводе он пересоздаётся из ссылки.
 */
export function transformMarkdownLinksInEditor(editorDiv: HTMLDivElement | null): void {
    if (!editorDiv) return;

    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(editorDiv, NodeFilter.SHOW_TEXT, {
        acceptNode(node: Node) {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (parent.closest('a, code, blockquote, script, style, iframe, .te-generated-embed')) return NodeFilter.FILTER_REJECT;
            const value = node.textContent || '';
            return (/!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)!?/).test(value)
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
        }
    } as any);

    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

    const mdRegex = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)(!?)/g;

    for (const node of textNodes) {
        const src = node.textContent || '';
        let last = 0;
        let hasMatch = false;
        const frag = document.createDocumentFragment();

        mdRegex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = mdRegex.exec(src)) !== null) {
            hasMatch = true;
            const [full, imgAlt, imgUrl, linkText, linkUrl, trailingBang] = match;
            const idx = match.index;
            if (idx > last) frag.appendChild(document.createTextNode(src.slice(last, idx)));

            const isImageSyntax = full.startsWith('![');
            const text = (isImageSyntax ? (imgAlt || imgUrl) : linkText) || '';
            const href = (isImageSyntax ? imgUrl : linkUrl || '').trim();
            const wantsEmbed = isImageSyntax || trailingBang === '!';
            const embedType: 'image' | 'rutube' | '' = wantsEmbed
                ? (isImageLink(href) ? 'image' : (getRutubeVideoId(href) ? 'rutube' : ''))
                : '';

            const a = document.createElement('a');
            a.href = href;
            a.textContent = text;
            if (embedType) {
                const mdId = `md-${Date.now()}-${generatedCounter++}`;
                a.dataset.mdEmbedType = embedType;
                a.dataset.mdEmbedId = mdId;
                frag.appendChild(a);
                frag.appendChild(createEmbedElement(embedType, href, mdId, text));
            } else {
                frag.appendChild(a);
            }

            last = idx + full.length;
        }

        if (!hasMatch) continue;
        if (last < src.length) frag.appendChild(document.createTextNode(src.slice(last)));
        node.parentNode?.replaceChild(frag, node);
    }

    const owners = new Set<string>();
    const anchors = Array.from(editorDiv.querySelectorAll('a[data-md-embed-type][data-md-embed-id]')) as HTMLAnchorElement[];
    for (const a of anchors) {
        const owner = a.dataset.mdEmbedId;
        const type = a.dataset.mdEmbedType as 'image' | 'rutube' | undefined;
        if (!owner || !type) continue;
        owners.add(owner);
        const existing = editorDiv.querySelector(`.te-generated-embed[data-md-embed-owner="${CSS.escape(owner)}"]`) as HTMLElement | null;
        if (!existing) {
            a.after(createEmbedElement(type, a.getAttribute('href') || '', owner, a.textContent || ''));
        }
    }

    const embeds = Array.from(editorDiv.querySelectorAll('.te-generated-embed[data-md-embed-owner]')) as HTMLElement[];
    for (const emb of embeds) {
        const owner = emb.dataset.mdEmbedOwner || '';
        if (!owners.has(owner)) emb.remove();
    }

}