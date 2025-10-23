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

            if (i === 0 && j < cols - 1) {
                const resizer = document.createElement('div');
                resizer.className = 'col-resizer';
                resizer.style.position = 'absolute';
                resizer.style.right = '-2px';
                resizer.style.top = '0';
                resizer.style.width = '6px';
                resizer.style.height = '100%';
                resizer.style.cursor = 'col-resize';
                resizer.style.userSelect = 'none';
                resizer.style.zIndex = '100';
                resizer.style.background = 'transparent';
                resizer.addEventListener('mousedown', (e) => startColResize(e, table, j));
                td.appendChild(resizer);
            }
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    range.collapse(false);
    range.insertNode(table);
    range.setStartAfter(table);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    setContent(editorDiv.innerHTML);
    updateActiveStates();
    setShowTableMenu(false);
}

/**
 * Функция для изменения размера столбца таблицы
 * @param e MouseEvent - Событие мыши
 * @param table HTMLTableElement - Таблица, в которой происходит изменение размера столбца
 * @param colIdx number - Индекс столбца, который изменяется
 */
function startColResize(e: MouseEvent, table: HTMLTableElement, colIdx: number) {
    e.preventDefault();
    e.stopPropagation();

    if (table.style.tableLayout !== 'fixed') {
        table.style.tableLayout = 'fixed';
        table.style.width = table.offsetWidth + 'px';
    }

    const startX = e.clientX;
    const firstRow = table.rows[0];
    const targetCell = firstRow.cells[colIdx];
    const startWidth = targetCell.offsetWidth;

    /**
     * Функция обработки движения мыши при изменении размера столбца
     * Устанавливает новую ширину для целевой ячейки и всех ячеек в этом столбце
     * @param ev MouseEvent - Событие мыши при движении
     */
    function onMouseMove(ev: MouseEvent) {
        const delta = ev.clientX - startX;
        const newWidth = Math.max(30, startWidth + delta);

        for (let i = 0; i < table.rows.length; i++) {
            const cell = table.rows[i].cells[colIdx];
            if (cell) {
                cell.style.width = newWidth + 'px';
                cell.style.minWidth = newWidth + 'px';
                cell.style.maxWidth = newWidth + 'px';
            }
        }
    }

    /**
     * Функция обработки отпускания кнопки мыши после изменения размера столбца
     * Удаляет обработчики событий движения и отпускания мыши
     */
    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}