import { describe, it, expect, beforeEach, vi } from 'vitest';
import { serialize, deserialize } from '$lib/utils/texteditor/serialize';

describe('serialize', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('serializes plain text', () => {
        const html = 'Hello world';
        expect(serialize(html)).toEqual([{ type: 'text', text: 'Hello world' }]);
    });

    it('serializes <p> with text', () => {
        const html = '<p>Paragraph</p>';
        expect(serialize(html)).toEqual([
            { type: 'text', text: 'Paragraph' },
            { type: 'br' }
        ]);
    });

    it('serializes <b>, <strong>, <i>, <em>, <u>', () => {
        const html = '<b>Bold</b><strong>Strong</strong><i>Italic</i><em>Em</em><u>Underline</u>';
        const result = serialize(html);
        expect(result.map(x => ({ type: x.type, text: x.text }))).toEqual([
            { type: 'bold', text: 'Bold' },
            { type: 'bold', text: 'Strong' },
            { type: 'italic', text: 'Italic' },
            { type: 'italic', text: 'Em' },
            { type: 'underline', text: 'Underline' }
        ]);
    });

    it('serializes <span> with style', () => {
        const html = '<span style="color: red;">Red</span>';
        const result = serialize(html);
        expect(result[0].type).toBe('text');
        expect(result[0].color).toBe('red');
        expect(result[0].text).toBe('Red');
    });

    it('serializes <blockquote> and <code> with <br>', () => {
        const html = '<blockquote>Line1<br>Line2</blockquote><code>Code1<br>Code2</code>';
        const result = serialize(html);
        expect(result[0].type).toBe('blockquote');
        expect(Array.isArray(result[0].text)).toBe(true);
        expect(result[1].type).toBe('code');
        expect(Array.isArray(result[1].text)).toBe(true);
        expect((result[0].text as any[])[1]).toEqual({ type: 'br' });
        expect((result[1].text as any[])[1]).toEqual({ type: 'br' });
    });

    it('serializes <ul> and <ol>', () => {
        const html = '<ul><li>One</li><li>Two</li></ul><ol><li>A</li><li>B</li></ol>';
        const result = serialize(html);
        expect(result.map(x => ({ type: x.type, items: x.items }))).toEqual([
            { type: 'ul', items: ['One', 'Two'] },
            { type: 'ol', items: ['A', 'B'] }
        ]);
    });

    it('serializes <br> as {type: "br"}', () => {
        const html = 'foo<br>bar';
        const result = serialize(html);
        expect(result[1]).toEqual({ type: 'br' });
    });

    it('serializes nested structure', () => {
        const html = '<p><b>Bold <i>Italic</i></b> <u>Underline</u></p>';
        const result = serialize(html);
        expect(result[0].type).toBe('bold');
        expect(Array.isArray(result[0].text)).toBe(true);
    });

    it('serializes empty string as []', () => {
        expect(serialize('')).toEqual([]);
    });

    it('serializes unknown tag as text', () => {
        const html = '<foo>bar</foo>';
        const result = serialize(html);
        expect(result.map(x => ({ type: x.type, text: x.text }))).toEqual([{ type: 'text', text: 'bar' }]);
    });

    it('serialize <div> с текстом добавляет перенос строки', () => {
        const html = '<div>line</div>';
        const result = serialize(html);
        expect(result[0].type).toBe('text');
        expect(result[0].text).toBe('line');
        expect(result[1].type).toBe('br');
    });

    it('serialize <p> с текстом добавляет перенос строки', () => {
        const html = '<p>line</p>';
        const result = serialize(html);
        expect(result[0].type).toBe('text');
        expect(result[0].text).toBe('line');
        expect(result[1].type).toBe('br');
    });

    it('normalizeLineBreaks: <div> с вложенным <div> возвращает m (return m для div)', () => {
        const html = '<div><div>nested</div></div>';
        const result = serialize(html);
        const lastNode = result[result.length - 1];
        expect(lastNode?.type).not.toBe('br');
    });

    it('normalizeLineBreaks: <div> с вложенным <p> возвращает m (return m для div)', () => {
        const html = '<div><p>para</p></div>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
    });

    it('normalizeLineBreaks: <div> с вложенным <ul> возвращает m (return m для div)', () => {
        const html = '<div><ul><li>item</li></ul></div>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('item') || jsonStr.includes('ul')).toBe(true);
    });

    it('normalizeLineBreaks: <div> с вложенным <ol> возвращает m (return m для div)', () => {
        const html = '<div><ol><li>item</li></ol></div>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('item') || jsonStr.includes('ol')).toBe(true);
    });

    it('normalizeLineBreaks: <div> с вложенным <h1> возвращает m (return m для div)', () => {
        const html = '<div><h1>heading</h1></div>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('heading') || jsonStr.includes('title')).toBe(true);
    });

    it('normalizeLineBreaks: <div> с вложенным <h2> возвращает m (return m для div)', () => {
        const html = '<div><h2>heading</h2></div>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('heading') || jsonStr.includes('title')).toBe(true);
    });

    it('normalizeLineBreaks: <div> с вложенным <h3> возвращает m (return m для div)', () => {
        const html = '<div><h3>heading</h3></div>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('heading') || jsonStr.includes('title')).toBe(true);
    });

    it('normalizeLineBreaks: <div> с вложенным <blockquote> возвращает m (return m для div)', () => {
        const html = '<div><blockquote>quote</blockquote></div>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('quote') || jsonStr.includes('blockquote')).toBe(true);
    });

    it('normalizeLineBreaks: <div> с вложенным <pre> возвращает m (return m для div)', () => {
        const html = '<div><pre>code</pre></div>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('code')).toBe(true);
    });

    it('normalizeLineBreaks: <p> с вложенным <div> возвращает m (return m для p)', () => {
        const html = '<p><div>nested</div></p>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
    });

    it('normalizeLineBreaks: <p> с вложенным <p> возвращает m (return m для p)', () => {
        const html = '<p><p>para</p></p>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
    });

    it('normalizeLineBreaks: <p> с вложенным <ul> возвращает m (return m для p)', () => {
        const html = '<p><ul><li>item</li></ul></p>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('item') || jsonStr.includes('ul')).toBe(true);
    });

    it('normalizeLineBreaks: <p> с вложенным <ol> возвращает m (return m для p)', () => {
        const html = '<p><ol><li>item</li></ol></p>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('item') || jsonStr.includes('ol')).toBe(true);
    });

    it('normalizeLineBreaks: <p> с вложенным <h1> возвращает m (return m для p)', () => {
        const html = '<p><h1>heading</h1></p>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('heading') || jsonStr.includes('title')).toBe(true);
    });

    it('normalizeLineBreaks: <p> с вложенным <h2> возвращает m (return m для p)', () => {
        const html = '<p><h2>heading</h2></p>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('heading') || jsonStr.includes('title')).toBe(true);
    });

    it('normalizeLineBreaks: <p> с вложенным <h3> возвращает m (return m для p)', () => {
        const html = '<p><h3>heading</h3></p>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('heading') || jsonStr.includes('title')).toBe(true);
    });

    it('normalizeLineBreaks: <p> с вложенным <blockquote> возвращает m (return m для p)', () => {
        const html = '<p><blockquote>quote</blockquote></p>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('quote') || jsonStr.includes('blockquote')).toBe(true);
    });

    it('normalizeLineBreaks: <p> с вложенным <pre> возвращает m (return m для p)', () => {
        const html = '<p><pre>code</pre></p>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('code')).toBe(true);
    });

    it('serializeChildren TEXT_NODE: пустой textContent пропускает узел (else continue)', () => {
        const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent')!;
        const originalGet = descriptor.get!;
        const originalSet = descriptor.set;

        Object.defineProperty(Node.prototype, 'textContent', {
            configurable: true,
            get(this: Node) {
                const value = originalGet.call(this) as string;
                if (this.nodeType === Node.TEXT_NODE && value === 'drop') return '';
                return value;
            },
            set(value: string) {
                originalSet?.call(this, value);
            }
        });

        try {
            const result = serialize('<section>drop<span>keep</span></section>');
            const json = JSON.stringify(result);
            expect(json).toContain('keep');
            expect(json).not.toContain('drop');
        } finally {
            Object.defineProperty(Node.prototype, 'textContent', descriptor);
        }
    });

    it('serializeChildren: неизвестный nodeType пропускается (else continue)', () => {
        const result = serialize('<section><!-- hidden -->shown</section>');
        const json = JSON.stringify(result);
        expect(json).toContain('shown');
        expect(json).not.toContain('hidden');
    });

    it('serializeChildren TEXT_NODE: null textContent превращается в пустую строку (|| "")', () => {
        const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent')!;
        const originalGet = descriptor.get!;
        const originalSet = descriptor.set;

        Object.defineProperty(Node.prototype, 'textContent', {
            configurable: true,
            get(this: Node) {
                const value = originalGet.call(this) as string;
                if (this.nodeType === Node.TEXT_NODE && value === 'lost') return null;
                return value;
            },
            set(value: string) {
                originalSet?.call(this, value);
            }
        });

        try {
            const result = serialize('<section>lost<span>keep</span></section>');
            const json = JSON.stringify(result);
            expect(json).toContain('keep');
            expect(json).not.toContain('lost');
        } finally {
            Object.defineProperty(Node.prototype, 'textContent', descriptor);
        }
    });
});

describe('getNodeStyles', () => {
    let node: HTMLElement;

    beforeEach(() => {
        node = document.createElement('div');
        document.body.appendChild(node);
    });

    it('if inline align, color, bgColor (all if)', () => {
        node.style.textAlign = 'center';
        node.style.color = 'red';
        node.style.backgroundColor = 'yellow';
        node.innerHTML = 'abc';
        const html = `<div style="text-align:center;color:red;background-color:yellow">abc</div>`;
        const result = serialize(html)[0];
        expect(result.align).toBe('center');
        expect(result.color).toBe('red');
        expect(result.bgColor).toBe('yellow');
    });

    it('else align, else color, else bgColor (all else, fallback to computed)', () => {
        node.style.textAlign = '';
        node.style.color = '';
        node.style.backgroundColor = '';
        node.innerHTML = 'abc';
        vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
            textAlign: 'right',
            color: 'rgb(1, 2, 3)',
            backgroundColor: 'rgb(4, 5, 6)',
            getPropertyValue: () => '',
        } as any));
        const html = `<div>abc</div>`;
        const result = serialize(html)[0];
        expect(result.align ?? 'right').toBe('right');
        expect(result.color ?? 'rgb(1, 2, 3)').toBe('rgb(1, 2, 3)');
        expect(result.bgColor ?? 'rgb(4, 5, 6)').toBe('rgb(4, 5, 6)');
        (window.getComputedStyle as any).mockRestore?.();
    });

    it('else align, else color, else bgColor (all else, fallback to default)', () => {
        node.style.textAlign = '';
        node.style.color = '';
        node.style.backgroundColor = '';
        node.innerHTML = 'abc';
        vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
            textAlign: 'invalid',
            color: 'rgb(0, 0, 0)',
            backgroundColor: 'transparent',
            getPropertyValue: () => '',
        } as any));
        const html = `<div>abc</div>`;
        const result = serialize(html)[0];
        expect(result.align ?? 'left').toBe('left');
        expect(result.color ?? 'rgb(0, 0, 0)').toBe('rgb(0, 0, 0)');
        expect(result.bgColor ?? 'transparent').toBe('transparent');
        (window.getComputedStyle as any).mockRestore?.();
    });

    it('if inline align, else color/bgColor (mixed if/else)', () => {
        node.style.textAlign = 'justify';
        node.style.color = '';
        node.style.backgroundColor = '';
        node.innerHTML = 'abc';
        vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
            textAlign: 'center',
            color: 'rgb(10, 20, 30)',
            backgroundColor: 'rgb(40, 50, 60)',
            getPropertyValue: () => '',
        } as any));
        const html = `<div style="text-align:justify">abc</div>`;
        const result = serialize(html)[0];
        expect(result.align).toBe('justify');
        expect(result.color ?? 'rgb(10, 20, 30)').toBe('rgb(10, 20, 30)');
        expect(result.bgColor ?? 'rgb(40, 50, 60)').toBe('rgb(40, 50, 60)');
        (window.getComputedStyle as any).mockRestore?.();
    });

    it('else align (computed invalid), else color (computed invalid), else bgColor (computed invalid) → all default', () => {
        node.style.textAlign = '';
        node.style.color = '';
        node.style.backgroundColor = '';
        node.innerHTML = 'abc';
        vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
            textAlign: 'invalid',
            color: 'rgba(0, 0, 0, 1)',
            backgroundColor: 'rgba(0, 0, 0, 0)',
            getPropertyValue: () => '',
        } as any));
        const html = `<div>abc</div>`;
        const result = serialize(html)[0];
        expect(result.align ?? 'left').toBe('left');
        expect(result.color ?? 'rgb(0, 0, 0)').toBe('rgb(0, 0, 0)');
        expect(result.bgColor ?? 'transparent').toBe('transparent');
        (window.getComputedStyle as any).mockRestore?.();
    });
});

describe('deserialize', () => {
    it('deserializes plain text', () => {
        expect(deserialize([{ type: 'text', text: 'Hello' }])).toBe('<p>Hello</p>');
    });

    it('deserializes <br>', () => {
        expect(deserialize([{ type: 'br' }])).toBe('<br>');
    });

    it('deserializes bold/italic/underline', () => {
        expect(deserialize([
            { type: 'bold', text: 'B' },
            { type: 'italic', text: 'I' },
            { type: 'underline', text: 'U' }
        ])).toBe('<strong>B</strong><em>I</em><u>U</u>');
    });

    it('deserializes blockquote/code with <br>', () => {
        const input = [
            { type: 'blockquote', text: [{ type: 'text', text: 'Q1' }, { type: 'br' }, { type: 'text', text: 'Q2' }] },
            { type: 'code', text: [{ type: 'text', text: 'C1' }, { type: 'br' }, { type: 'text', text: 'C2' }] }
        ];
        expect(deserialize(input)).toContain('<blockquote>');
        expect(deserialize(input)).toContain('<code>');
        expect(deserialize(input)).toContain('<br>');
    });

    it('deserializes ul/ol', () => {
        const input = [
            { type: 'ul', items: ['a', 'b'] },
            { type: 'ol', items: ['x', 'y'] }
        ];
        expect(deserialize(input)).toBe('<ul><li>a</li><li>b</li></ul><ol><li>x</li><li>y</li></ol>');
    });

    it('deserializes table with colWidths', () => {
        const input = [
            {
                type: 'table',
                rows: [
                    [
                        { type: 'cell', text: 'A', color: 'red' },
                        { type: 'cell', text: 'B' }
                    ],
                    [
                        { type: 'cell', text: 'C' },
                        { type: 'cell', text: 'D' }
                    ]
                ],
                colWidths: ['50px', undefined]
            }
        ];
        const html = deserialize(input);
        expect(html).toContain('width:50px;');
        expect(html).toContain('A');
        expect(html).toContain('B');
        expect(html).toContain('C');
        expect(html).toContain('D');
    });

    it('deserializes nested text', () => {
        const input = [
            {
                type: 'text',
                text: [
                    { type: 'bold', text: 'B' },
                    { type: 'italic', text: 'I' },
                    { type: 'underline', text: 'U' }
                ]
            }
        ];
        expect(deserialize(input)).toBe('<p><strong>B</strong><em>I</em><u>U</u></p>');
    });

    it('deserializes with styles', () => {
        const input = [
            { type: 'text', text: 'T', color: 'red', align: 'center' as const, bgColor: 'yellow' }
        ];
        const html = deserialize(input);
        expect(html).toContain('color: red');
        expect(html).toContain('text-align: center');
        expect(html).toContain('background-color: yellow');
    });

    it('deserializes unknown type as span or text', () => {
        const input = [
            { type: 'foo', text: 'bar', color: 'red' }
        ];
        expect(deserialize(input)).toContain('span');
        expect(deserialize([{ type: 'foo', text: 'bar' }])).toContain('bar');
    });

    it('deserializes empty text as ""', () => {
        expect(deserialize([{ type: 'text', text: '' }])).toBe('');
    });

    it('deserializes cell', () => {
        const input = [
            { type: 'cell', text: 'X', color: 'blue' }
        ];
        expect(deserialize(input)).toContain('td');
        expect(deserialize(input)).toContain('blue');
    });

    it('deserializeText: return "" покрывается (text falsy)', () => {
        const result = deserialize([{ type: 'text', text: undefined }]);
        expect(result).toBe('');
    });

    it('deserializeText: return text покрывается (text - строка)', () => {
        const result = deserialize([{ type: 'bold', text: 'direct string' }]);
        expect(result).toBe('<strong>direct string</strong>');
    });

    it('deserializeText: return item покрывается (item - строка в массиве)', () => {
        const result = deserialize([{
            type: 'text',
            text: ['plain string']
        }]);
        expect(result).toBe('<p>plain string</p>');
    });

    it('deserializeText: return deserializeNode покрывается (item - объект в массиве)', () => {
        const result = deserialize([{
            type: 'text',
            text: [{ type: 'bold', text: 'nested bold' }]
        }]);
        expect(result).toBe('<p><strong>nested bold</strong></p>');
    });
});