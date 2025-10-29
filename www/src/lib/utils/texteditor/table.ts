/**
 * Вставляет таблицу заданного размера в редактируемый HTML-документ.
 * 
 * Таблица вставляется в текущую позицию курсора. Каждая ячейка получает стили границы и отступа.
 * После вставки обновляется содержимое редактора и состояние интерфейса.
 * 
 * @param editorDiv - DOM-элемент редактируемой области
 * @param rows - Количество строк в таблице
 * @param cols - Количество столбцов в таблице
 * @param selectionInsideCodeOrQuote - Функция, возвращающая true, если курсор находится внутри блока code или blockquote
 * @param updateActiveStates - Функция для обновления состояния панели инструментов редактора
 * @param setContent - Функция для обновления переменной содержимого редактора
 * @param setShowTableMenu - Функция для управления отображением меню вставки таблицы
 */
export function insertTable(
    editorDiv: HTMLDivElement | null,
    rows: number,
    cols: number,
    selectionInsideCodeOrQuote: () => boolean,
    updateActiveStates: () => void,
    setContent: (content: string) => void,
    setShowTableMenu: (show: boolean) => void
) {
    if (!editorDiv) return;
    if (selectionInsideCodeOrQuote()) return;

    editorDiv.focus();

    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.tableLayout = 'auto';
    table.style.width = '100%';

    for (let i = 0; i < rows; i++) {
        const tr = document.createElement('tr');
        for (let j = 0; j < cols; j++) {
            const td = document.createElement('td');
            td.style.border = '1px solid #ccc';
            td.style.padding = '4px 8px';
            td.setAttribute('data-col-idx', String(j));
            td.innerHTML = '&nbsp;';
            td.style.position = 'relative';
            td.style.verticalAlign = 'top';
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        editorDiv.appendChild(table);
    } else {
        const range = selection.getRangeAt(0);
        range.collapse(false);
        range.insertNode(table);
        range.setStartAfter(table);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    try { setContent(editorDiv.innerHTML); } catch {}
    try { updateActiveStates(); } catch {}
    try { setShowTableMenu(false); } catch {}
}