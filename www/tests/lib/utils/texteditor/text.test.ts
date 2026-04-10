import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    execCommand,
    applyColor,
    applyBgColor,
    insertList,
    stripTagsAndStyles,
    insertBlock,
    setAlign,
    transformMarkdownLinksInEditor
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

describe('Transform markdown links in text editor', () => {
    const originalCss = (globalThis as any).CSS;

    beforeEach(() => {
        if (!(globalThis as any).CSS || typeof (globalThis as any).CSS.escape !== 'function') {
            (globalThis as any).CSS = {
                ...(originalCss || {}),
                escape: (value: string) => value.replace(/"/g, '\\"')
            };
        }
    });

    afterEach(() => {
        (globalThis as any).CSS = originalCss;
    });

    it('Transforms image markdown into link and image embed', () => {
        editorDiv.innerHTML = '![Preview](https://example.com/img.png)';

        transformMarkdownLinksInEditor(editorDiv);

        const link = editorDiv.querySelector('a') as HTMLAnchorElement;
        const img = editorDiv.querySelector('.te-generated-embed-image img') as HTMLImageElement;

        expect(link).not.toBeNull();
        expect(link.textContent).toBe('Preview');
        expect(link.dataset.mdEmbedType).toBe('image');
        expect(link.dataset.mdEmbedId).toBeTruthy();
        expect(img).not.toBeNull();
        expect(img.getAttribute('src')).toBe('https://example.com/img.png');
    });

    it('Transforms rutube markdown with trailing bang into mini player embed', () => {
        editorDiv.innerHTML = '[Watch](https://rutube.ru/video/abcdef123456)!';

        transformMarkdownLinksInEditor(editorDiv);

        const link = editorDiv.querySelector('a') as HTMLAnchorElement;
        const iframe = editorDiv.querySelector('.te-generated-embed-rutube iframe') as HTMLIFrameElement;

        expect(link).not.toBeNull();
        expect(link.dataset.mdEmbedType).toBe('rutube');
        expect(iframe).not.toBeNull();
        expect(iframe.getAttribute('src')).toContain('https://rutube.ru/play/embed/abcdef123456');
    });

    it('Transforms rutube embed-path markdown into mini player embed', () => {
        editorDiv.innerHTML = '[Watch](https://rutube.ru/play/embed/emb321)!';

        transformMarkdownLinksInEditor(editorDiv);

        const iframe = editorDiv.querySelector('.te-generated-embed-rutube iframe') as HTMLIFrameElement;
        expect(iframe).not.toBeNull();
        expect(iframe.getAttribute('src')).toContain('https://rutube.ru/play/embed/emb321');
    });

    it('Transforms rutube fallback-path markdown into mini player embed', () => {
        editorDiv.innerHTML = '[Watch](https://rutube.ru/channel/lastid)!';

        transformMarkdownLinksInEditor(editorDiv);

        const iframe = editorDiv.querySelector('.te-generated-embed-rutube iframe') as HTMLIFrameElement;
        expect(iframe).not.toBeNull();
        expect(iframe.getAttribute('src')).toContain('https://rutube.ru/play/embed/lastid');
    });

    it('Keeps ordinary markdown link without embed', () => {
        editorDiv.innerHTML = '[Site](https://example.com)';

        transformMarkdownLinksInEditor(editorDiv);

        const link = editorDiv.querySelector('a') as HTMLAnchorElement;
        const embed = editorDiv.querySelector('.te-generated-embed');

        expect(link).not.toBeNull();
        expect(link.getAttribute('href')).toBe('https://example.com');
        expect(link.dataset.mdEmbedType).toBeUndefined();
        expect(embed).toBeNull();
    });

    it('Regenerates missing embed from marked link on next transform', () => {
        editorDiv.innerHTML = '![A](https://example.com/a.webp)';
        transformMarkdownLinksInEditor(editorDiv);

        const firstEmbed = editorDiv.querySelector('.te-generated-embed');
        firstEmbed?.remove();

        transformMarkdownLinksInEditor(editorDiv);

        const regenerated = editorDiv.querySelector('.te-generated-embed-image img') as HTMLImageElement;
        expect(regenerated).not.toBeNull();
        expect(regenerated.getAttribute('src')).toBe('https://example.com/a.webp');
    });

    it('Removes orphan embed without owner link', () => {
        editorDiv.innerHTML = '<div class="te-generated-embed te-generated-embed-image" data-md-embed-owner="orphan"></div>';

        transformMarkdownLinksInEditor(editorDiv);

        expect(editorDiv.querySelector('.te-generated-embed')).toBeNull();
    });

    it('Handles null editor safely', () => {
        expect(() => transformMarkdownLinksInEditor(null)).not.toThrow();
    });

    it('Handles rutube subdomain links with trailing bang', () => {
        editorDiv.innerHTML = '[Watch](https://video.rutube.ru/video/subdomain123)!';
        transformMarkdownLinksInEditor(editorDiv);
        const link = editorDiv.querySelector('a') as HTMLAnchorElement;
        const iframe = editorDiv.querySelector('.te-generated-embed-rutube iframe') as HTMLIFrameElement;
        expect(link).not.toBeNull();
        expect(link.dataset.mdEmbedType).toBe('rutube');
        expect(iframe).not.toBeNull();
        expect(iframe.getAttribute('src')).toContain('https://rutube.ru/play/embed/subdomain123');
    });

    it('Skips embed for malformed bang link', () => {
        editorDiv.innerHTML = '[Watch](ht!tp://bad url)!';
        transformMarkdownLinksInEditor(editorDiv);
        const link = editorDiv.querySelector('a') as HTMLAnchorElement;
        const embed = editorDiv.querySelector('.te-generated-embed');
        expect(link).not.toBeNull();
        expect(link.dataset.mdEmbedType).toBeUndefined();
        expect(embed).toBeNull();
    });

    it('Skips embed for non-rutube bang link', () => {
        editorDiv.innerHTML = '[Watch](https://example.com/video/abc123)!';
        transformMarkdownLinksInEditor(editorDiv);
        const link = editorDiv.querySelector('a') as HTMLAnchorElement;
        const embed = editorDiv.querySelector('.te-generated-embed');
        expect(link).not.toBeNull();
        expect(link.getAttribute('href')).toBe('https://example.com/video/abc123');
        expect(link.dataset.mdEmbedType).toBeUndefined();
        expect(embed).toBeNull();
    });

    it('Skips embed for rutube root link with bang', () => {
        editorDiv.innerHTML = '[Watch](https://rutube.ru/)!';
        transformMarkdownLinksInEditor(editorDiv);
        const link = editorDiv.querySelector('a') as HTMLAnchorElement;
        const embed = editorDiv.querySelector('.te-generated-embed');
        expect(link).not.toBeNull();
        expect(link.getAttribute('href')).toBe('https://rutube.ru/');
        expect(link.dataset.mdEmbedType).toBeUndefined();
        expect(embed).toBeNull();
    });

    it('Uses empty embed id for invalid marked rutube owner link', () => {
        editorDiv.innerHTML = '<a href="https://example.com/video/abc" data-md-embed-type="rutube" data-md-embed-id="forced-rutube">Watch</a>';
        transformMarkdownLinksInEditor(editorDiv);
        const iframe = editorDiv.querySelector('.te-generated-embed-rutube iframe') as HTMLIFrameElement;
        expect(iframe).not.toBeNull();
        expect(iframe.getAttribute('src')).toBe('https://rutube.ru/play/embed/');
    });

    it('Rejects orphan text node through NodeFilter return path', () => {
        editorDiv.innerHTML = 'Unchanged';
        let filterResult: number | undefined;
        const orphanTextNode = document.createTextNode('[Link](https://example.com)');
        // @ts-ignore
        vi.spyOn(document, 'createTreeWalker').mockImplementation((root: Node, whatToShow: number, filter?: NodeFilter | null) => {
            filterResult = (filter as any).acceptNode(orphanTextNode);
            return {
                currentNode: root,
                nextNode: () => null
            } as any;
        });

        transformMarkdownLinksInEditor(editorDiv);

        expect(filterResult).toBe(NodeFilter.FILTER_REJECT);
        expect(editorDiv.innerHTML).toBe('Unchanged');
        expect(editorDiv.querySelector('a')).toBeNull();
    });

    it('Uses fallback empty value when text content is missing', () => {
        let filterResult: number | undefined;
        let testedValue: string | undefined;
        const originalTest = RegExp.prototype.test;
        vi.spyOn(RegExp.prototype, 'test').mockImplementation(function (this: RegExp, value: string) {
            if (this.source === '!\\[[^\\]]*\\]\\([^)]+\\)|\\[[^\\]]+\\]\\([^)]+\\)!?') testedValue = value;
            return originalTest.call(this, value);
        });
        // @ts-ignore
        vi.spyOn(document, 'createTreeWalker').mockImplementation((root: Node, whatToShow: number, filter?: NodeFilter | null) => {
            const fakeNode = {
                parentElement: {
                    closest: () => null
                },
                textContent: undefined
            } as unknown as Node;
            filterResult = (filter as any).acceptNode(fakeNode);
            return {
                currentNode: root,
                nextNode: () => null
            } as any;
        });
        transformMarkdownLinksInEditor(editorDiv);
        expect(filterResult).toBe(NodeFilter.FILTER_REJECT);
        expect(testedValue).toBe('');
    });

    it('Uses fallback empty src when node text content is missing', () => {
        editorDiv.innerHTML = 'Keep';
        let execInput: string | undefined;
        const originalExec = RegExp.prototype.exec;
        vi.spyOn(RegExp.prototype, 'exec').mockImplementation(function (this: RegExp, input: string) {
            if (this.source === '!\\[([^\\]]*)\\]\\(([^)]+)\\)|\\[([^\\]]+)\\]\\(([^)]+)\\)(!?)' && this.flags.includes('g')) execInput = input;
            return originalExec.call(this, input);
        });
        const replaceChild = vi.fn();
        const fakeNode = {
            textContent: undefined,
            parentNode: { replaceChild }
        } as unknown as Text;
        let emitted = false;
        vi.spyOn(document, 'createTreeWalker').mockImplementation(() => {
            return {
                currentNode: fakeNode,
                nextNode: () => {
                    if (emitted) return null;
                    emitted = true;
                    return fakeNode;
                }
            } as any;
        });
        transformMarkdownLinksInEditor(editorDiv);
        expect(execInput).toBe('');
        expect(replaceChild).not.toHaveBeenCalled();
        expect(editorDiv.innerHTML).toBe('Keep');
    });

    it('Preserves leading plain text before first markdown match', () => {
        editorDiv.innerHTML = 'Lead [Site](https://example.com)';
        const createTextNodeSpy = vi.spyOn(document, 'createTextNode');
        transformMarkdownLinksInEditor(editorDiv);
        expect(createTextNodeSpy).toHaveBeenCalledTimes(1);
        expect(createTextNodeSpy).toHaveBeenCalledWith('Lead ');
        expect(editorDiv.firstChild?.nodeType).toBe(Node.TEXT_NODE);
        expect(editorDiv.firstChild?.textContent).toBe('Lead ');
        const link = editorDiv.querySelector('a') as HTMLAnchorElement;
        expect(link).not.toBeNull();
        expect(link.getAttribute('href')).toBe('https://example.com');
    });

    it('Falls back to image url when markdown image alt is empty', () => {
        editorDiv.innerHTML = '![](https://example.com/fallback.png)';
        transformMarkdownLinksInEditor(editorDiv);
        const link = editorDiv.querySelector('a') as HTMLAnchorElement;
        expect(link).not.toBeNull();
        expect(link.textContent).toBe('https://example.com/fallback.png');
        expect(link.getAttribute('href')).toBe('https://example.com/fallback.png');
    });

    it('Uses empty text when markdown link text capture is missing', () => {
        editorDiv.innerHTML = '[Label](https://example.com)';
        const originalExec = RegExp.prototype.exec;
        let injected = false;
        vi.spyOn(RegExp.prototype, 'exec').mockImplementation(function (this: RegExp, input: string) {
            if (this.source === '!\\[([^\\]]*)\\]\\(([^)]+)\\)|\\[([^\\]]+)\\]\\(([^)]+)\\)(!?)' && this.flags.includes('g')) {
                if (!injected) {
                    injected = true;
                    const match = ['[Label](https://example.com)', undefined, undefined, undefined, 'https://example.com', ''] as unknown as RegExpExecArray;
                    match.index = 0;
                    match.input = input;
                    this.lastIndex = input.length;
                    return match;
                }
                return null;
            }
            return originalExec.call(this, input);
        });
        transformMarkdownLinksInEditor(editorDiv);
        const link = editorDiv.querySelector('a') as HTMLAnchorElement;
        expect(link).not.toBeNull();
        expect(link.textContent).toBe('');
        expect(link.getAttribute('href')).toBe('https://example.com');
    });

    it('Falls back to empty href when markdown link url capture is missing', () => {
        editorDiv.innerHTML = '[Label](https://example.com)';
        const originalExec = RegExp.prototype.exec;
        const originalTrim = String.prototype.trim;
        let injected = false;
        let trimmedEmpty = false;
        vi.spyOn(String.prototype, 'trim').mockImplementation(function (this: string) {
            if (String(this) === '') trimmedEmpty = true;
            return originalTrim.call(this);
        });
        vi.spyOn(RegExp.prototype, 'exec').mockImplementation(function (this: RegExp, input: string) {
            if (this.source === '!\\[([^\\]]*)\\]\\(([^)]+)\\)|\\[([^\\]]+)\\]\\(([^)]+)\\)(!?)' && this.flags.includes('g')) {
                if (!injected) {
                    injected = true;
                    const match = ['[Label](https://example.com)', undefined, undefined, 'Label', undefined, ''] as unknown as RegExpExecArray;
                    match.index = 0;
                    match.input = input;
                    this.lastIndex = input.length;
                    return match;
                }
                return null;
            }
            return originalExec.call(this, input);
        });
        transformMarkdownLinksInEditor(editorDiv);
        const link = editorDiv.querySelector('a') as HTMLAnchorElement;
        expect(trimmedEmpty).toBe(true);
        expect(link).not.toBeNull();
        expect(link.textContent).toBe('Label');
        expect(link.getAttribute('href')).toBe('');
    });

    it('Appends trailing plain text after markdown match', () => {
        editorDiv.innerHTML = '[Site](https://example.com) tail';
        const createTextNodeSpy = vi.spyOn(document, 'createTextNode');
        transformMarkdownLinksInEditor(editorDiv);
        expect(createTextNodeSpy).toHaveBeenCalledWith(' tail');
        expect(editorDiv.childNodes.length).toBe(2);
        expect(editorDiv.firstChild?.nodeName).toBe('A');
        expect(editorDiv.lastChild?.nodeType).toBe(Node.TEXT_NODE);
        expect(editorDiv.lastChild?.textContent).toBe(' tail');
    });

    it('Skips anchor processing when embed type is empty', () => {
        editorDiv.innerHTML = '<a href="https://example.com/img.png" data-md-embed-id="owner-1" data-md-embed-type="">Img</a>';
        const afterSpy = vi.spyOn(Element.prototype, 'after');
        transformMarkdownLinksInEditor(editorDiv);
        const anchor = editorDiv.querySelector('a[data-md-embed-id="owner-1"]') as HTMLAnchorElement;
        expect(anchor).not.toBeNull();
        expect(afterSpy).not.toHaveBeenCalled();
        expect(editorDiv.querySelector('.te-generated-embed')).toBeNull();
    });

    it('Uses empty href and label fallbacks when marked anchor has null values', () => {
        editorDiv.innerHTML = '';
        const anchor = document.createElement('a');
        anchor.dataset.mdEmbedType = 'image';
        anchor.dataset.mdEmbedId = 'owner-fallback';
        editorDiv.appendChild(anchor);
        const originalGetAttribute = anchor.getAttribute.bind(anchor);
        const getAttributeSpy = vi.spyOn(anchor, 'getAttribute').mockImplementation((name: string) => {
            if (name === 'href') return null;
            return originalGetAttribute(name);
        });
        const textContentSpy = vi.spyOn(anchor, 'textContent', 'get').mockReturnValue(null);
        transformMarkdownLinksInEditor(editorDiv);
        const img = editorDiv.querySelector('.te-generated-embed-image img') as HTMLImageElement;
        expect(getAttributeSpy).toHaveBeenCalledWith('href');
        expect(textContentSpy).toHaveBeenCalled();
        expect(img).not.toBeNull();
        expect(img.getAttribute('src')).toBe('');
        expect(img.getAttribute('alt')).toBe('');
    });

    it('Removes embed when owner resolves to empty fallback value', () => {
        editorDiv.innerHTML = '<div class="te-generated-embed te-generated-embed-image" data-md-embed-owner=""></div>';
        const hasSpy = vi.spyOn(Set.prototype, 'has');
        transformMarkdownLinksInEditor(editorDiv);
        expect(hasSpy).toHaveBeenCalledWith('');
        expect(editorDiv.querySelector('.te-generated-embed')).toBeNull();
    });
});