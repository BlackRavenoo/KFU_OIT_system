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
            } else { 
                // Do nothing 
            };
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
 */
export function stripTagsAndStyles(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

/**
 * Вставляет блок цитаты или кода
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