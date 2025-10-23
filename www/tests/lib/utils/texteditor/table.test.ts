import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { insertTable } from '$lib/utils/texteditor/table';

let editorDiv: HTMLDivElement;
let selectionInsideCodeOrQuote: ReturnType<typeof vi.fn>;
let updateActiveStates: ReturnType<typeof vi.fn>;
let setContent: ReturnType<typeof vi.fn>;
let setShowTableMenu: ReturnType<typeof vi.fn>;

beforeEach(() => {
    editorDiv = document.createElement('div');
    editorDiv.contentEditable = 'true';
    editorDiv.innerHTML = '<p>Test content</p>';
    document.body.appendChild(editorDiv);

    selectionInsideCodeOrQuote = vi.fn().mockReturnValue(false);
    updateActiveStates = vi.fn();
    setContent = vi.fn();
    setShowTableMenu = vi.fn();

    editorDiv.focus();
    const range = document.createRange();
    const selection = window.getSelection();
    if (selection) {
        range.selectNodeContents(editorDiv);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }
});

afterEach(() => {
    document.body.removeChild(editorDiv);
    vi.restoreAllMocks();
});

describe('Insert new table in text editor', () => {
    it('Inserts table with specified rows and columns', () => {
        insertTable(editorDiv, 2, 3, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        const table = editorDiv.querySelector('table');
        expect(table).not.toBeNull();
        expect(table?.querySelectorAll('tr').length).toBe(2);
        expect(table?.querySelectorAll('tr')[0].querySelectorAll('td').length).toBe(3);
    });

    it('Does not insert table when editorDiv is null', () => {
        insertTable(null, 2, 2, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        expect(setContent).not.toHaveBeenCalled();
        expect(updateActiveStates).not.toHaveBeenCalled();
        expect(setShowTableMenu).not.toHaveBeenCalled();
    });

    it('Does not insert table when inside code or quote', () => {
        selectionInsideCodeOrQuote.mockReturnValue(true);

        insertTable(editorDiv, 2, 2, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        const table = editorDiv.querySelector('table');
        expect(table).toBeNull();
        expect(setContent).not.toHaveBeenCalled();
    });

    it('Sets correct table styles', () => {
        insertTable(editorDiv, 2, 2, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        const table = editorDiv.querySelector('table');
        expect(table?.style.borderCollapse).toBe('collapse');
    });

    it('Sets correct cell styles', () => {
        insertTable(editorDiv, 2, 2, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        const cells = editorDiv.querySelectorAll('td');
        cells.forEach(cell => {
            const td = cell as HTMLTableCellElement;
            expect(td.style.border).toBe('1px solid rgb(204, 204, 204)');
            expect(td.style.padding).toBe('4px 8px');
        });
    });

    it('Calls setContent with editor innerHTML', () => {
        insertTable(editorDiv, 2, 2, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        expect(setContent).toHaveBeenCalledWith(editorDiv.innerHTML);
        expect(setContent).toHaveBeenCalledTimes(1);
    });

    it('Calls updateActiveStates', () => {
        insertTable(editorDiv, 2, 2, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        expect(updateActiveStates).toHaveBeenCalledTimes(1);
    });

    it('Calls setShowTableMenu with false', () => {
        insertTable(editorDiv, 2, 2, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        expect(setShowTableMenu).toHaveBeenCalledWith(false);
        expect(setShowTableMenu).toHaveBeenCalledTimes(1);
    });

    it('Inserts table of size 1x1', () => {
        insertTable(editorDiv, 1, 1, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        const table = editorDiv.querySelector('table');
        expect(table?.querySelectorAll('tr').length).toBe(1);
        expect(table?.querySelectorAll('td').length).toBe(1);
    });

    it('Inserts large table correctly', () => {
        insertTable(editorDiv, 10, 10, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        const table = editorDiv.querySelector('table');
        expect(table?.querySelectorAll('tr').length).toBe(10);
        expect(table?.querySelectorAll('td').length).toBe(100);
    });

    it('Does not insert table when selection is null', () => {
        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
        }

        insertTable(editorDiv, 2, 2, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        const table = editorDiv.querySelector('table');
        expect(table).toBeNull();
    });

    it('Focuses editor before inserting table', () => {
        const focusSpy = vi.spyOn(editorDiv, 'focus');

        insertTable(editorDiv, 2, 2, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        expect(focusSpy).toHaveBeenCalled();
    });

    it('Places cursor after inserted table', () => {
        insertTable(editorDiv, 2, 2, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        const selection = window.getSelection();
        const range = selection?.getRangeAt(0);
        const table = editorDiv.querySelector('table');

        expect(range?.startContainer).toBe(table?.parentNode);
        expect(range?.collapsed).toBe(true);
    });

    it('Inserts table at cursor position', () => {
        editorDiv.innerHTML = '<p>Before</p><p>After</p>';
        editorDiv.focus();

        const range = document.createRange();
        const selection = window.getSelection();
        const firstP = editorDiv.querySelector('p');
        
        if (firstP && selection) {
            range.setStart(firstP.firstChild!, 6);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        insertTable(editorDiv, 1, 1, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        const table = editorDiv.querySelector('table');
        expect(table).not.toBeNull();
        expect(editorDiv.contains(table!)).toBe(true);
    });

    it('Creates correct table structure', () => {
        insertTable(editorDiv, 3, 2, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        const table = editorDiv.querySelector('table');
        const rows = table?.querySelectorAll('tr');
        
        expect(rows?.length).toBe(3);
        
        rows?.forEach(row => {
            const cells = row.querySelectorAll('td');
            expect(cells.length).toBe(2);
        });
    });

    it('Handles zero rows', () => {
        insertTable(editorDiv, 0, 3, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        const table = editorDiv.querySelector('table');
        expect(table?.querySelectorAll('tr').length).toBe(0);
        expect(setContent).toHaveBeenCalled();
    });

    it('Handles zero columns', () => {
        insertTable(editorDiv, 3, 0, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        const table = editorDiv.querySelector('table');
        const firstRow = table?.querySelector('tr');
        expect(firstRow?.querySelectorAll('td').length).toBe(0);
        expect(setContent).toHaveBeenCalled();
    });

    it('Handles negative rows', () => {
        insertTable(editorDiv, -1, 2, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        const table = editorDiv.querySelector('table');
        expect(table?.querySelectorAll('tr').length).toBe(0);
    });

    it('Handles negative columns', () => {
        insertTable(editorDiv, 2, -1, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        const table = editorDiv.querySelector('table');
        const firstRow = table?.querySelector('tr');
        expect(firstRow?.querySelectorAll('td').length).toBe(0);
    });
});

describe('Integration tests for tables in text editor', () => {
    it('Complete table insertion workflow', () => {
        expect(editorDiv.querySelector('table')).toBeNull();

        insertTable(editorDiv, 2, 3, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        expect(editorDiv.querySelector('table')).not.toBeNull();
        expect(selectionInsideCodeOrQuote).toHaveBeenCalled();
        expect(updateActiveStates).toHaveBeenCalled();
        expect(setContent).toHaveBeenCalledWith(editorDiv.innerHTML);
        expect(setShowTableMenu).toHaveBeenCalledWith(false);
    });

    it('Preserves existing content', () => {
        const originalContent = editorDiv.innerHTML;

        insertTable(editorDiv, 1, 1, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        expect(editorDiv.innerHTML).toContain('Test content');
        expect(editorDiv.innerHTML).not.toBe(originalContent);
    });

    it('Multiple table insertions', () => {
        insertTable(editorDiv, 1, 1, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);
        
        const firstTable = editorDiv.querySelector('table');
        expect(firstTable).not.toBeNull();

        insertTable(editorDiv, 2, 2, selectionInsideCodeOrQuote, updateActiveStates, setContent, setShowTableMenu);

        const tables = editorDiv.querySelectorAll('table');
        expect(tables.length).toBe(2);
    });
});