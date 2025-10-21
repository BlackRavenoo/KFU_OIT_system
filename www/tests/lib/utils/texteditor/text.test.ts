import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    execCommand,
    applyColor,
    applyBgColor,
    insertList,
    stripTagsAndStyles,
    insertBlock,
    setAlign
} from '$lib/utils/texteditor/text';

let editorDiv: HTMLDivElement;
let selectionInsideCodeOrQuote: ReturnType<typeof vi.fn>;
let updateActiveStates: ReturnType<typeof vi.fn>;
let setContent: ReturnType<typeof vi.fn>;

beforeEach(() => {
    editorDiv = document.createElement('div');
    editorDiv.contentEditable = 'true';
    editorDiv.innerHTML = '<p>Test content</p>';
    document.body.appendChild(editorDiv);

    selectionInsideCodeOrQuote = vi.fn().mockReturnValue(false);
    updateActiveStates = vi.fn();
    setContent = vi.fn();

    editorDiv.focus();
    const range = document.createRange();
    const selection = window.getSelection();
    if (selection) {
        range.selectNodeContents(editorDiv);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    document.execCommand = vi.fn();
});

afterEach(() => {
    document.body.removeChild(editorDiv);
    vi.restoreAllMocks();
});

describe('Exec command in text editor', () => {
    it('Executes command with value', () => {
        execCommand(editorDiv, 'fontSize', '14px', selectionInsideCodeOrQuote, updateActiveStates);

        expect(document.execCommand).toHaveBeenCalledWith('fontSize', false, '14px');
        expect(updateActiveStates).toHaveBeenCalled();
    });

    it('Executes command without value', () => {
        execCommand(editorDiv, 'bold', undefined, selectionInsideCodeOrQuote, updateActiveStates);

        expect(document.execCommand).toHaveBeenCalledWith('bold', false, undefined);
        expect(updateActiveStates).toHaveBeenCalled();
    });

    it('Does not execute when editorDiv is null', () => {
        execCommand(null, 'bold', undefined, selectionInsideCodeOrQuote, updateActiveStates);

        expect(document.execCommand).not.toHaveBeenCalled();
        expect(updateActiveStates).not.toHaveBeenCalled();
    });

    it('Does not execute when inside code or quote', () => {
        selectionInsideCodeOrQuote.mockReturnValue(true);

        execCommand(editorDiv, 'bold', undefined, selectionInsideCodeOrQuote, updateActiveStates);

        expect(document.execCommand).not.toHaveBeenCalled();
        expect(updateActiveStates).not.toHaveBeenCalled();
    });

    it('Focuses editor before executing command', () => {
        const focusSpy = vi.spyOn(editorDiv, 'focus');

        execCommand(editorDiv, 'bold', undefined, selectionInsideCodeOrQuote, updateActiveStates);

        expect(focusSpy).toHaveBeenCalled();
    });

    it('Calls updateActiveStates after command execution', () => {
        execCommand(editorDiv, 'italic', undefined, selectionInsideCodeOrQuote, updateActiveStates);

        expect(updateActiveStates).toHaveBeenCalledTimes(1);
    });
});

describe('Apply color for text editor', () => {
    it('Applies foreground color', () => {
        applyColor(editorDiv, '#ff0000', selectionInsideCodeOrQuote, updateActiveStates);

        expect(document.execCommand).toHaveBeenCalledWith('styleWithCSS', false, 'true');
        expect(document.execCommand).toHaveBeenCalledWith('foreColor', false, '#ff0000');
        expect(updateActiveStates).toHaveBeenCalled();
    });

    it('Does not apply when editorDiv is null', () => {
        applyColor(null, '#ff0000', selectionInsideCodeOrQuote, updateActiveStates);

        expect(document.execCommand).not.toHaveBeenCalled();
        expect(updateActiveStates).not.toHaveBeenCalled();
    });

    it('Does not apply when inside code or quote', () => {
        selectionInsideCodeOrQuote.mockReturnValue(true);

        applyColor(editorDiv, '#ff0000', selectionInsideCodeOrQuote, updateActiveStates);

        expect(document.execCommand).not.toHaveBeenCalled();
        expect(updateActiveStates).not.toHaveBeenCalled();
    });

    it('Focuses editor before applying color', () => {
        const focusSpy = vi.spyOn(editorDiv, 'focus');

        applyColor(editorDiv, '#00ff00', selectionInsideCodeOrQuote, updateActiveStates);

        expect(focusSpy).toHaveBeenCalled();
    });

    it('Applies different color values', () => {
        applyColor(editorDiv, 'rgb(255, 0, 0)', selectionInsideCodeOrQuote, updateActiveStates);

        expect(document.execCommand).toHaveBeenCalledWith('foreColor', false, 'rgb(255, 0, 0)');
    });
});

describe('Apply background color for text editor', () => {
    it('Applies background color to selected text', () => {
        applyBgColor(editorDiv, '#ffff00', selectionInsideCodeOrQuote, updateActiveStates, setContent);

        expect(document.execCommand).toHaveBeenCalledWith('styleWithCSS', false, 'true');
        expect(document.execCommand).toHaveBeenCalledWith('backColor', false, '#ffff00');
        expect(updateActiveStates).toHaveBeenCalled();
    });

    it('Does not apply when editorDiv is null', () => {
        applyBgColor(null, '#ffff00', selectionInsideCodeOrQuote, updateActiveStates, setContent);

        expect(document.execCommand).not.toHaveBeenCalled();
        expect(updateActiveStates).not.toHaveBeenCalled();
    });

    it('Does not apply when inside code or quote', () => {
        selectionInsideCodeOrQuote.mockReturnValue(true);

        applyBgColor(editorDiv, '#ffff00', selectionInsideCodeOrQuote, updateActiveStates, setContent);

        expect(document.execCommand).not.toHaveBeenCalled();
        expect(updateActiveStates).not.toHaveBeenCalled();
    });

    it('Does not apply when no selection', () => {
        const selection = window.getSelection();
        selection?.removeAllRanges();

        applyBgColor(editorDiv, '#ffff00', selectionInsideCodeOrQuote, updateActiveStates, setContent);

        expect(document.execCommand).not.toHaveBeenCalled();
    });

    it('Applies background to table cells', () => {
        editorDiv.innerHTML = '<table><tr><td id="cell1">Cell 1</td><td id="cell2">Cell 2</td></tr></table>';
        
        const cell1 = document.getElementById('cell1') as HTMLElement;
        const range = document.createRange();
        range.selectNodeContents(cell1);
        
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        applyBgColor(editorDiv, '#ff00ff', selectionInsideCodeOrQuote, updateActiveStates, setContent);

        expect(cell1.style.backgroundColor).toBe('rgb(255, 0, 255)');
        expect(setContent).toHaveBeenCalledWith(editorDiv.innerHTML);
        expect(updateActiveStates).toHaveBeenCalled();
    });

    it('Applies background to single table cell when cursor inside', () => {
        editorDiv.innerHTML = '<table><tr><td id="targetCell">Cell content</td></tr></table>';
        
        const cell = document.getElementById('targetCell') as HTMLElement;
        const textNode = cell.firstChild as Text;
        
        const range = document.createRange();
        range.setStart(textNode, 0);
        range.setEnd(textNode, 4);
        
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        applyBgColor(editorDiv, '#0000ff', selectionInsideCodeOrQuote, updateActiveStates, setContent);

        expect(cell.style.backgroundColor).toBe('rgb(0, 0, 255)');
        expect(setContent).toHaveBeenCalledWith(editorDiv.innerHTML);
    });

    it('Applies to multiple table cells', () => {
        editorDiv.innerHTML = '<table><tr><td id="c1">A</td><td id="c2">B</td><td id="c3">C</td></tr></table>';
        
        const c1 = document.getElementById('c1') as HTMLElement;
        const c3 = document.getElementById('c3') as HTMLElement;
        
        const range = document.createRange();
        range.setStart(c1.firstChild!, 0);
        range.setEnd(c3.firstChild!, 1);
        
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        applyBgColor(editorDiv, '#00ffff', selectionInsideCodeOrQuote, updateActiveStates, setContent);

        const cells = editorDiv.querySelectorAll('td');
        cells.forEach(cell => {
            const td = cell as HTMLElement;
            expect(td.style.backgroundColor).toBeTruthy();
        });
    });

    it('Focuses editor before applying background', () => {
        const focusSpy = vi.spyOn(editorDiv, 'focus');

        applyBgColor(editorDiv, '#ff0000', selectionInsideCodeOrQuote, updateActiveStates, setContent);

        expect(focusSpy).toHaveBeenCalled();
    });

    it('Applies background to cells using intersectsNode when boundary comparison fails', () => {
        editorDiv.innerHTML = '<table><tr><td id="cell1">A</td><td id="cell2">B</td></tr></table>';
        
        const cell1 = document.getElementById('cell1') as HTMLElement;
        const range = document.createRange();
        range.setStart(cell1.firstChild!, 0);
        range.setEnd(cell1.firstChild!, 0);
        
        const table = editorDiv.querySelector('table');
        range.setStartBefore(table!);
        range.setEndAfter(cell1);
        
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        applyBgColor(editorDiv, '#ff0000', selectionInsideCodeOrQuote, updateActiveStates, setContent);

        expect(cell1.style.backgroundColor).toBe('rgb(255, 0, 0)');
        expect(setContent).toHaveBeenCalledWith(editorDiv.innerHTML);
        expect(updateActiveStates).toHaveBeenCalled();
    });

    it('Applies background to TH cell when cursor is inside table header', () => {
        editorDiv.innerHTML = '<table><thead><tr><th id="header1">Header 1</th><th id="header2">Header 2</th></tr></thead></table>';
        
        const th = document.getElementById('header1') as HTMLElement;
        const textNode = th.firstChild as Text;
        const range = document.createRange();
        range.setStart(textNode, 0);
        range.collapse(true);
        
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        applyBgColor(editorDiv, '#00ff00', selectionInsideCodeOrQuote, updateActiveStates, setContent);

        expect(th.style.backgroundColor).toBe('rgb(0, 255, 0)');
        expect(setContent).toHaveBeenCalledWith(editorDiv.innerHTML);
        expect(updateActiveStates).toHaveBeenCalled();
    });
});

describe('Insert list to text editor', () => {
    it('Inserts ordered list', () => {
        insertList(editorDiv, 'ol', selectionInsideCodeOrQuote, updateActiveStates);

        expect(document.execCommand).toHaveBeenCalledWith('insertOrderedList');
        expect(updateActiveStates).toHaveBeenCalled();
    });

    it('Inserts unordered list', () => {
        insertList(editorDiv, 'ul', selectionInsideCodeOrQuote, updateActiveStates);

        expect(document.execCommand).toHaveBeenCalledWith('insertUnorderedList');
        expect(updateActiveStates).toHaveBeenCalled();
    });

    it('Does not insert when editorDiv is null', () => {
        insertList(null, 'ul', selectionInsideCodeOrQuote, updateActiveStates);

        expect(document.execCommand).not.toHaveBeenCalled();
        expect(updateActiveStates).not.toHaveBeenCalled();
    });

    it('Does not insert when inside code or quote', () => {
        selectionInsideCodeOrQuote.mockReturnValue(true);

        insertList(editorDiv, 'ol', selectionInsideCodeOrQuote, updateActiveStates);

        expect(document.execCommand).not.toHaveBeenCalled();
        expect(updateActiveStates).not.toHaveBeenCalled();
    });

    it('Focuses editor before inserting list', () => {
        const focusSpy = vi.spyOn(editorDiv, 'focus');

        insertList(editorDiv, 'ul', selectionInsideCodeOrQuote, updateActiveStates);

        expect(focusSpy).toHaveBeenCalled();
    });
});

describe('Strip tags and styles in text editor', () => {
    it('Strips HTML tags', () => {
        const html = '<p><strong>Bold</strong> and <em>italic</em> text</p>';
        const result = stripTagsAndStyles(html);

        expect(result).toBe('Bold and italic text');
    });

    it('Strips inline styles', () => {
        const html = '<span style="color: red; font-size: 20px;">Styled text</span>';
        const result = stripTagsAndStyles(html);

        expect(result).toBe('Styled text');
    });

    it('Handles nested tags', () => {
        const html = '<div><p><span><strong>Nested</strong></span></p></div>';
        const result = stripTagsAndStyles(html);

        expect(result).toBe('Nested');
    });

    it('Returns empty string for empty input', () => {
        const result = stripTagsAndStyles('');

        expect(result).toBe('');
    });

    it('Preserves plain text', () => {
        const html = 'Plain text without tags';
        const result = stripTagsAndStyles(html);

        expect(result).toBe('Plain text without tags');
    });

    it('Handles special characters', () => {
        const html = '<p>&lt;script&gt;alert("xss")&lt;/script&gt;</p>';
        const result = stripTagsAndStyles(html);

        expect(result).toContain('script');
    });

    it('Strips complex HTML structure', () => {
        const html = `
            <div class="container">
                <h1 style="color: blue;">Title</h1>
                <p>Paragraph with <a href="#">link</a></p>
                <ul>
                    <li>Item 1</li>
                    <li>Item 2</li>
                </ul>
            </div>
        `;
        const result = stripTagsAndStyles(html);

        expect(result).toContain('Title');
        expect(result).toContain('Paragraph with link');
        expect(result).toContain('Item 1');
        expect(result).toContain('Item 2');
    });
});

describe('Insert blocks to text editor', () => {
    it('Inserts blockquote', () => {
        editorDiv.innerHTML = '<p>Selected text</p>';
        const p = editorDiv.querySelector('p');
        
        const range = document.createRange();
        range.selectNodeContents(p!);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        insertBlock(editorDiv, 'blockquote', selectionInsideCodeOrQuote, updateActiveStates, setContent);

        const blockquote = editorDiv.querySelector('blockquote');
        expect(blockquote).not.toBeNull();
        expect(blockquote?.textContent).toBe('Selected text');
        expect(setContent).toHaveBeenCalledWith(editorDiv.innerHTML);
        expect(updateActiveStates).toHaveBeenCalled();
    });

    it('Inserts code block', () => {
        editorDiv.innerHTML = '<p>Code snippet</p>';
        const p = editorDiv.querySelector('p');
        
        const range = document.createRange();
        range.selectNodeContents(p!);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        insertBlock(editorDiv, 'code', selectionInsideCodeOrQuote, updateActiveStates, setContent);

        const code = editorDiv.querySelector('code');
        expect(code).not.toBeNull();
        expect(code?.textContent).toBe('Code snippet');
    });

    it('Does not insert when editorDiv is null', () => {
        insertBlock(null, 'blockquote', selectionInsideCodeOrQuote, updateActiveStates, setContent);

        expect(setContent).not.toHaveBeenCalled();
        expect(updateActiveStates).not.toHaveBeenCalled();
    });

    it('Does not insert when inside code or quote', () => {
        selectionInsideCodeOrQuote.mockReturnValue(true);

        insertBlock(editorDiv, 'blockquote', selectionInsideCodeOrQuote, updateActiveStates, setContent);

        expect(setContent).not.toHaveBeenCalled();
        expect(updateActiveStates).not.toHaveBeenCalled();
    });

    it('Does not insert when no selection', () => {
        const selection = window.getSelection();
        selection?.removeAllRanges();

        insertBlock(editorDiv, 'blockquote', selectionInsideCodeOrQuote, updateActiveStates, setContent);

        expect(setContent).not.toHaveBeenCalled();
    });

    it('Strips formatting from selected text', () => {
        editorDiv.innerHTML = '<p><strong style="color: red;">Formatted</strong> text</p>';
        const p = editorDiv.querySelector('p');
        
        const range = document.createRange();
        range.selectNodeContents(p!);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        insertBlock(editorDiv, 'code', selectionInsideCodeOrQuote, updateActiveStates, setContent);

        const code = editorDiv.querySelector('code');
        expect(code?.innerHTML).not.toContain('<strong');
        expect(code?.innerHTML).not.toContain('style=');
    });

    it('Inserts block and positions cursor', () => {
        editorDiv.innerHTML = '<p>Text</p>';
        const p = editorDiv.querySelector('p');
        
        const range = document.createRange();
        range.selectNodeContents(p!);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        insertBlock(editorDiv, 'blockquote', selectionInsideCodeOrQuote, updateActiveStates, setContent);

        const blockquote = editorDiv.querySelector('blockquote');
        const newRange = selection?.getRangeAt(0);
        
        expect(blockquote).not.toBeNull();
        expect(blockquote?.textContent).toBe('Text');
        expect(newRange?.collapsed).toBe(true);
        expect(setContent).toHaveBeenCalledWith(editorDiv.innerHTML);
        expect(updateActiveStates).toHaveBeenCalled();
    });

    it('Focuses editor before inserting block', () => {
        editorDiv.innerHTML = '<p>Text</p>';
        const p = editorDiv.querySelector('p');
        
        const range = document.createRange();
        range.selectNodeContents(p!);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        const focusSpy = vi.spyOn(editorDiv, 'focus');

        insertBlock(editorDiv, 'code', selectionInsideCodeOrQuote, updateActiveStates, setContent);

        expect(focusSpy).toHaveBeenCalled();
    });
});

describe('Align text in text editor', () => {
    it('Aligns text to left', () => {
        setAlign(editorDiv, 'left', selectionInsideCodeOrQuote, updateActiveStates);

        expect(document.execCommand).toHaveBeenCalledWith('justifyLeft', false, undefined);
        expect(updateActiveStates).toHaveBeenCalled();
    });

    it('Aligns text to center', () => {
        setAlign(editorDiv, 'center', selectionInsideCodeOrQuote, updateActiveStates);

        expect(document.execCommand).toHaveBeenCalledWith('justifyCenter', false, undefined);
        expect(updateActiveStates).toHaveBeenCalled();
    });

    it('Aligns text to right', () => {
        setAlign(editorDiv, 'right', selectionInsideCodeOrQuote, updateActiveStates);

        expect(document.execCommand).toHaveBeenCalledWith('justifyRight', false, undefined);
        expect(updateActiveStates).toHaveBeenCalled();
    });

    it('Justifies text', () => {
        setAlign(editorDiv, 'justify', selectionInsideCodeOrQuote, updateActiveStates);

        expect(document.execCommand).toHaveBeenCalledWith('justifyFull', false, undefined);
        expect(updateActiveStates).toHaveBeenCalled();
    });

    it('Does not align when editorDiv is null', () => {
        setAlign(null, 'center', selectionInsideCodeOrQuote, updateActiveStates);

        expect(document.execCommand).not.toHaveBeenCalled();
        expect(updateActiveStates).not.toHaveBeenCalled();
    });

    it('Does not align when inside code or quote', () => {
        selectionInsideCodeOrQuote.mockReturnValue(true);

        setAlign(editorDiv, 'center', selectionInsideCodeOrQuote, updateActiveStates);

        expect(document.execCommand).not.toHaveBeenCalled();
        expect(updateActiveStates).not.toHaveBeenCalled();
    });

    it('Focuses editor before aligning', () => {
        const focusSpy = vi.spyOn(editorDiv, 'focus');

        setAlign(editorDiv, 'center', selectionInsideCodeOrQuote, updateActiveStates);

        expect(focusSpy).toHaveBeenCalled();
    });
});

describe('Integration tests for text functions in text editor', () => {
    it('Complete formatting workflow', () => {
        execCommand(editorDiv, 'bold', undefined, selectionInsideCodeOrQuote, updateActiveStates);
        expect(updateActiveStates).toHaveBeenCalledTimes(1);

        applyColor(editorDiv, '#ff0000', selectionInsideCodeOrQuote, updateActiveStates);
        expect(updateActiveStates).toHaveBeenCalledTimes(2);

        insertList(editorDiv, 'ul', selectionInsideCodeOrQuote, updateActiveStates);
        expect(updateActiveStates).toHaveBeenCalledTimes(3);
    });

    it('Multiple commands execution', () => {
        execCommand(editorDiv, 'bold', undefined, selectionInsideCodeOrQuote, updateActiveStates);
        execCommand(editorDiv, 'italic', undefined, selectionInsideCodeOrQuote, updateActiveStates);
        execCommand(editorDiv, 'underline', undefined, selectionInsideCodeOrQuote, updateActiveStates);

        expect(document.execCommand).toHaveBeenCalledTimes(3);
        expect(updateActiveStates).toHaveBeenCalledTimes(3);
    });
});