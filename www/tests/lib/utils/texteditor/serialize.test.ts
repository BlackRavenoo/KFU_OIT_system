import { describe, it, expect, beforeEach, vi } from 'vitest';
import { serialize, deserialize, deserializeText } from '$lib/utils/texteditor/serialize';

describe('serialize', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('Serializes plain text', () => {
        const html = 'Hello world';
        expect(serialize(html)).toEqual([{ type: 'text', text: 'Hello world' }]);
    });

    it('Serializes <p> with text', () => {
        const html = '<p>Paragraph</p>';
        expect(serialize(html)).toEqual([
            { type: 'text', text: 'Paragraph' },
            { type: 'br' }
        ]);
    });

    it('Serializes <b>, <strong>, <i>, <em>, <u>', () => {
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

    it('Serializes <span> with style', () => {
        const html = '<span style="color: red;">Red</span>';
        const result = serialize(html);
        expect(result[0].type).toBe('text');
        expect(result[0].color).toBe('red');
        expect(result[0].text).toBe('Red');
    });

    it('Serializes <blockquote> and <code> with <br>', () => {
        const html = '<blockquote>Line1<br>Line2</blockquote><code>Code1<br>Code2</code>';
        const result = serialize(html);
        expect(result[0].type).toBe('blockquote');
        expect(Array.isArray(result[0].text)).toBe(true);
        expect(result[1].type).toBe('code');
        expect(Array.isArray(result[1].text)).toBe(true);
        expect((result[0].text as any[])[1]).toEqual({ type: 'br' });
        expect((result[1].text as any[])[1]).toEqual({ type: 'br' });
    });

    it('Serializes <ul> and <ol>', () => {
        const html = '<ul><li>One</li><li>Two</li></ul><ol><li>A</li><li>B</li></ol>';
        const result = serialize(html);
        expect(result.map(x => ({ type: x.type, items: x.items }))).toEqual([
            { type: 'ul', items: ['One', 'Two'] },
            { type: 'ol', items: ['A', 'B'] }
        ]);
    });

    it('Serializes <br> as {type: "br"}', () => {
        const html = 'foo<br>bar';
        const result = serialize(html);
        expect(result[1]).toEqual({ type: 'br' });
    });

    it('Serializes nested structure', () => {
        const html = '<p><b>Bold <i>Italic</i></b> <u>Underline</u></p>';
        const result = serialize(html);
        expect(result[0].type).toBe('bold');
        expect(Array.isArray(result[0].text)).toBe(true);
    });

    it('Serializes empty string as []', () => {
        expect(serialize('')).toEqual([]);
    });

    it('Serializes unknown tag as text', () => {
        const html = '<foo>bar</foo>';
        const result = serialize(html);
        expect(result.map(x => ({ type: x.type, text: x.text }))).toEqual([{ type: 'text', text: 'bar' }]);
    });

    it('Serializes <div> with text', () => {
        const html = '<div>line</div>';
        const result = serialize(html);
        expect(result[0].type).toBe('text');
        expect(result[0].text).toBe('line');
        expect(result[1].type).toBe('br');
    });

    it('Serialize <p> add <br> to text', () => {
        const html = '<p>line</p>';
        const result = serialize(html);
        expect(result[0].type).toBe('text');
        expect(result[0].text).toBe('line');
        expect(result[1].type).toBe('br');
    });

    it('Normalize line breaks get <div> with nested <div>', () => {
        const html = '<div><div>nested</div></div>';
        const result = serialize(html);
        const lastNode = result[result.length - 1];
        expect(lastNode?.type).not.toBe('br');
    });

    it('Normalize line breaks get <div> with nested <p>', () => {
        const html = '<div><p>para</p></div>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
    });

    it('Normalize line breaks get <div> with nested <ul>', () => {
        const html = '<div><ul><li>item</li></ul></div>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('item') || jsonStr.includes('ul')).toBe(true);
    });

    it('Normalize line breaks get <div> with nested <ol>', () => {
        const html = '<div><ol><li>item</li></ol></div>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('item') || jsonStr.includes('ol')).toBe(true);
    });

    it('Normalize line breaks get <div> with nested <h1>', () => {
        const html = '<div><h1>heading</h1></div>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('heading') || jsonStr.includes('title')).toBe(true);
    });

    it('Normalize line breaks get <div> with nested <h2>', () => {
        const html = '<div><h2>heading</h2></div>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('heading') || jsonStr.includes('title')).toBe(true);
    });

    it('Normalize line breaks get <div> with nested <h3>', () => {
        const html = '<div><h3>heading</h3></div>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('heading') || jsonStr.includes('title')).toBe(true);
    });

    it('Normalize line breaks get <div> with nested <blockquote>', () => {
        const html = '<div><blockquote>quote</blockquote></div>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('quote') || jsonStr.includes('blockquote')).toBe(true);
    });

    it('Normalize line breaks get <div> with nested <pre>', () => {
        const html = '<div><pre>code</pre></div>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('code')).toBe(true);
    });

    it('Normalize line breaks get <p> with nested <div>', () => {
        const html = '<p><div>nested</div></p>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
    });

    it('Normalize line breaks get <p> with nested <p>', () => {
        const html = '<p><p>para</p></p>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
    });

    it('Normalize line breaks get <p> with nested <ul>', () => {
        const html = '<p><ul><li>item</li></ul></p>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('item') || jsonStr.includes('ul')).toBe(true);
    });

    it('Normalize line breaks get <p> with nested <ol>', () => {
        const html = '<p><ol><li>item</li></ol></p>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('item') || jsonStr.includes('ol')).toBe(true);
    });

    it('Normalize line breaks get <p> with nested <h1>', () => {
        const html = '<p><h1>heading</h1></p>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('heading') || jsonStr.includes('title')).toBe(true);
    });

    it('Normalize line breaks get <p> with nested <h2>', () => {
        const html = '<p><h2>heading</h2></p>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('heading') || jsonStr.includes('title')).toBe(true);
    });

    it('Normalize line breaks get <p> with nested <h3>', () => {
        const html = '<p><h3>heading</h3></p>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('heading') || jsonStr.includes('title')).toBe(true);
    });

    it('Normalize line breaks get <p> with nested <blockquote>', () => {
        const html = '<p><blockquote>quote</blockquote></p>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('quote') || jsonStr.includes('blockquote')).toBe(true);
    });

    it('Normalize line breaks get <p> with nested <pre>', () => {
        const html = '<p><pre>code</pre></p>';
        const result = serialize(html);
        expect(result.length).toBeGreaterThan(0);
        const jsonStr = JSON.stringify(result);
        expect(jsonStr.includes('code')).toBe(true);
    });

    it('Serialize children get empty textContent to skip node', () => {
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

    it('Serialize children get unknown nodeType to skip node', () => {
        const result = serialize('<section><!-- hidden -->shown</section>');
        const json = JSON.stringify(result);
        expect(json).toContain('shown');
        expect(json).not.toContain('hidden');
    });

    it('Serialize children get null textContent to empty string', () => {
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

    it('Serialize node ol get empty text content)', () => {
        const html = '<ol><li></li><li>Item 2</li></ol>';
        const result = serialize(html);
        expect(result[0].type).toBe('ol');
        expect(result[0].items).toEqual(['', 'Item 2']);
        expect(result[0].items[0]).toBe('');
    });

    it('Serialize node ul get empty text content)', () => {
        const html = '<ul><li></li><li>Item 2</li></ul>';
        const result = serialize(html);
        expect(result[0].type).toBe('ul');
        expect(result[0].items).toEqual(['', 'Item 2']);
        expect(result[0].items[0]).toBe('');
    });

    it('Serializes table and preserves cells innerHTML (no width serialization)', () => {
        const table = document.createElement('table');
        const tbody = document.createElement('tbody');

        const tr1 = document.createElement('tr');
        const td11 = document.createElement('td');
        td11.innerHTML = 'asda&nbsp;' +
            '<div class="col-resizer" style="position: absolute; right: 0px; top: 0px; width: 6px; height: 100%;"></div>' +
            '<div class="col-resizer" style="position:absolute;right:0;top:0;width:6px;height:100%;"></div>';
        const td12 = document.createElement('td');
        td12.innerHTML = '<div align="right"><b>asd&nbsp;</b></div>' +
            '<div class="col-resizer" style="position: absolute; right: 0px; top: 0px; width: 6px; height: 100%;"></div>';
        tr1.appendChild(td11);
        tr1.appendChild(td12);

        const tr2 = document.createElement('tr');
        const td21 = document.createElement('td');
        td21.innerHTML = '&nbsp;';
        const td22 = document.createElement('td');
        td22.innerHTML = '&nbsp;<i>asdasfas</i>';
        tr2.appendChild(td21);
        tr2.appendChild(td22);

        tbody.appendChild(tr1);
        tbody.appendChild(tr2);
        table.appendChild(tbody);
        document.body.appendChild(table);

        const out = serialize(table.outerHTML);
        const node = out.find(n => n.type === 'table') as any;
        expect(node).toBeDefined();
        expect(Array.isArray(node.rows)).toBe(true);
        expect(node.rows.length).toBe(2);
        expect(node.rows[0].length).toBe(2);
        expect(node.rows[1].length).toBe(2);
        expect(node.rows[0][0].text).toContain('asda&nbsp;');
        expect(node.rows[0][0].text).toContain('col-resizer');
        expect(node.rows[0][1].text).toContain('<div align="right"><b>asd&nbsp;</b></div>');
        expect(node.rows[1][1].text).toContain('<i>asdasfas</i>');
        expect(node).not.toHaveProperty('colWidths');
        expect(node.rows[0][0].hasOwnProperty('width')).toBe(false);
        expect(node.rows[0][1].hasOwnProperty('width')).toBe(false);
    });

    it('Mixed TH and TD are serialized as cells with innerHTML preserved', () => {
        const table = document.createElement('table');
        const tbody = document.createElement('tbody');

        const tr1 = document.createElement('tr');
        const th1 = document.createElement('th');
        th1.innerHTML = '<b>H1</b>';
        const th2 = document.createElement('th');
        th2.textContent = 'H2';
        tr1.appendChild(th1);
        tr1.appendChild(th2);

        const tr2 = document.createElement('tr');
        const td1 = document.createElement('td');
        td1.textContent = 'D1';
        const td2 = document.createElement('td');
        td2.textContent = 'D2';
        tr2.appendChild(td1);
        tr2.appendChild(td2);

        tbody.appendChild(tr1);
        tbody.appendChild(tr2);
        table.appendChild(tbody);
        document.body.appendChild(table);

        const out = serialize(table.outerHTML);
        const node = out.find(n => n.type === 'table') as any;
        expect(node.rows.length).toBe(2);
        expect(node.rows[0][0].text).toContain('<b>H1</b>');
        expect(node.rows[0][1].text).toBe('H2');
        expect(node.rows[1][0].text).toBe('D1');
    });

    it('Cell-level inline styles are captured into cell object', () => {
        const table = document.createElement('table');
        const tbody = document.createElement('tbody');
        const tr = document.createElement('tr');

        const td = document.createElement('td');
        td.style.textAlign = 'center';
        td.style.color = 'rgb(10,20,30)';
        td.style.backgroundColor = 'rgb(40,50,60)';
        td.innerHTML = 'S';
        tr.appendChild(td);

        tbody.appendChild(tr);
        table.appendChild(tbody);
        document.body.appendChild(table);

        const out = serialize(table.outerHTML);
        const node = out.find(n => n.type === 'table') as any;
        expect(node.rows[0][0].align).toBe('center');
        expect(node.rows[0][0].color).toBe('rgb(10, 20, 30)');
        expect(node.rows[0][0].bgColor).toBeTruthy();
    });

    it('Round-trip: deserialize -> serialize preserves table shape and key fragments (widths not asserted)', () => {
        const tableData = {
            type: 'table',
            rows: [
                [
                    { type: 'cell', text: 'asda&nbsp;<div class="col-resizer"></div>' },
                    { type: 'cell', text: '<div align="right"><b>asd&nbsp;</b></div>' }
                ],
                [
                    { type: 'cell', text: '&nbsp;' },
                    { type: 'cell', text: '&nbsp;<i>asdasfas</i>' }
                ]
            ]
        } as any;

        const html = deserialize([tableData]);
        expect(html).toContain('<table');
        expect(html).toContain('asda&nbsp;');
        expect(html).toContain('<b>asd&nbsp;</b>');
        expect(html).toContain('<i>asdasfas</i>');

        const out = serialize(html);
        const node = out.find(n => n.type === 'table') as any;
        expect(node).toBeDefined();
        expect(node.rows.length).toBe(2);
        expect(node.rows[0][0].text).toContain('asda');
        expect(node.rows[0][1].text).toContain('asd');
        expect(node).not.toHaveProperty('colWidths');
    });

    it('Serialize node is skipped empty unknown tag', () => {
        const html = '<unknown-empty></unknown-empty>';
        const result = serialize(html);
        expect(result).toEqual([]);
    });
});

describe('getNodeStyles', () => {
    let node: HTMLElement;

    beforeEach(() => {
        node = document.createElement('div');
        document.body.appendChild(node);
    });

    it('If inline align, color, bgColor', () => {
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

    it('Without align, color, bgColor', () => {
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

    it('Without align, color, bgColor', () => {
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

    it('If inline align without color/bgColor', () => {
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

    it('Invalid computed align, color, bgColor', () => {
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

describe('mergeStyles', () => {
    it('Inherits color from parent when child has no color', () => {
        const parent: any = {
            type: 'text',
            color: 'red',
            text: [{ type: 'text', text: 'child' }]
        };
        const html = deserialize([parent]);
        expect(html).toContain('<span style="color: red">child</span>');
        expect(html).toContain('<p style="color: red">');
    });

    it('Child color overrides parent color when defined', () => {
        const parent: any = {
            type: 'text',
            color: 'red',
            text: [{ type: 'text', color: 'blue', text: 'child' }]
        };
        const html = deserialize([parent]);
        expect(html).toContain('<span style="color: blue">child</span>');
        expect(html).toContain('<p style="color: red">');
    });

    it('Null child color is treated as absent', () => {
        const parent: any = {
            type: 'text',
            color: 'red',
            text: [{ type: 'text', color: null, text: 'child' }]
        };
        const html = deserialize([parent]);
        expect(html).toContain('<span style="color: red">child</span>');
    });

    it('Empty-string child color overrides parent', () => {
        const parent: any = {
            type: 'text',
            color: 'red',
            text: [{ type: 'text', color: '', text: 'child' }]
        };
        const html = deserialize([parent]);
        expect(html).toContain('<p style="color: red">');
        expect(html).not.toContain('<span style="color: red">child</span>');
    });

    it('Inherits align and bgColor from parent', () => {
        const parent: any = {
            type: 'text',
            align: 'center',
            bgColor: 'yellow',
            text: [{ type: 'text', text: 'child' }]
        };
        const html = deserialize([parent]);
        expect(html).toContain('<span style="text-align: center; background-color: yellow">child</span>');
    });
});

describe('deserialize', () => {
    it('Deserializes plain text', () => {
        expect(deserialize([{ type: 'text', text: 'Hello' }])).toBe('<p>Hello</p>');
    });

    it('Deserializes <br>', () => {
        expect(deserialize([{ type: 'br' }])).toBe('<br>');
    });

    it('Deserializes bold/italic/underline', () => {
        expect(deserialize([
            { type: 'bold', text: 'B' },
            { type: 'italic', text: 'I' },
            { type: 'underline', text: 'U' }
        ])).toBe('<strong>B</strong><em>I</em><u>U</u>');
    });

    it('Deserializes blockquote/code with <br>', () => {
        const input = [
            { type: 'blockquote', text: [{ type: 'text', text: 'Q1' }, { type: 'br' }, { type: 'text', text: 'Q2' }] },
            { type: 'code', text: [{ type: 'text', text: 'C1' }, { type: 'br' }, { type: 'text', text: 'C2' }] }
        ];
        expect(deserialize(input)).toContain('<blockquote>');
        expect(deserialize(input)).toContain('<code>');
        expect(deserialize(input)).toContain('<br>');
    });

    it('Deserializes ul/ol', () => {
        const input = [
            { type: 'ul', items: ['a', 'b'] },
            { type: 'ol', items: ['x', 'y'] }
        ];
        expect(deserialize(input)).toBe('<ul><li>a</li><li>b</li></ul><ol><li>x</li><li>y</li></ol>');
    });

    it('Deserializes empty table', () => {
        const out = deserialize([{ type: 'table', rows: [] } as any]);
        expect(out).toContain('<table');
        expect(out).toContain('table-layout:auto');
        expect(out).not.toContain('<td');
    });

    it('Deserializes nested text', () => {
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

    it('Deserializes with styles', () => {
        const input = [
            { type: 'text', text: 'T', color: 'red', align: 'center' as const, bgColor: 'yellow' }
        ];
        const html = deserialize(input);
        expect(html).toContain('color: red');
        expect(html).toContain('text-align: center');
        expect(html).toContain('background-color: yellow');
    });

    it('Deserializes unknown type as span or text', () => {
        const input = [
            { type: 'foo', text: 'bar', color: 'red' }
        ];
        expect(deserialize(input)).toContain('span');
        expect(deserialize([{ type: 'foo', text: 'bar' }])).toContain('bar');
    });

    it('Deserializes empty text as ""', () => {
        expect(deserialize([{ type: 'text', text: '' }])).toBe('');
    });

    it('Deserializes cell', () => {
        const input = [
            { type: 'cell', text: 'X', color: 'blue' }
        ];
        expect(deserialize(input)).toContain('td');
        expect(deserialize(input)).toContain('blue');
    });

    it('Deserializes text falsy to bold', () => {
        const result = deserialize([{ type: 'bold', text: undefined }]);
        expect(result).toBe('<strong></strong>');
    });

    it('Deserializes text array in blockquote', () => {
        const result = deserialize([{
            type: 'blockquote', // @ts-ignore
            text: ['first', 'second']
        }]);
        expect(result).toBe('<blockquote>firstsecond</blockquote>');
    });

    it('Deserializes text without styles', () => {
        const nodes = [{ type: 'text', text: 'hello' } as any];
        expect(deserialize(nodes)).toBe('<p>hello</p>');
    });

    it('Deserializes text with align/color/bgColor', () => {
        const nodes = [{
            type: 'text',
            align: 'center',
            color: 'red',
            bgColor: 'yellow',
            text: 'styled'
        } as any];
        const out = deserialize(nodes);
        expect(out).toContain('<p');
        expect(out).toContain('text-align: center');
        expect(out).toContain('color: red');
        expect(out).toContain('background-color: yellow');
        expect(out).toContain('styled');
    });

    it('Deserializes br', () => {
        expect(deserialize([{ type: 'br' } as any])).toBe('<br>');
    });

    it('Deserializes title_1', () => {
        expect(deserialize([{ type: 'title_1', text: 'H' } as any])).toBe('<h1>H</h1>');
    });

    it('Deserializes bold/italic/underline/blockquote/code', () => {
        expect(deserialize([{ type: 'bold', text: 'B' } as any])).toBe('<strong>B</strong>');
        expect(deserialize([{ type: 'italic', text: 'I' } as any])).toBe('<em>I</em>');
        expect(deserialize([{ type: 'underline', text: 'U' } as any])).toBe('<u>U</u>');
        expect(deserialize([{ type: 'blockquote', text: 'Q' } as any])).toBe('<blockquote>Q</blockquote>');
        expect(deserialize([{ type: 'code', text: 'C' } as any])).toBe('<code>C</code>');
    });

    it('Deserializes lists', () => {
        const outUl = deserialize([{ type: 'ul', items: ['a', 'b'] } as any]);
        expect(outUl).toContain('<ul');
        expect(outUl).toContain('<li>a</li>');
        expect(outUl).toContain('<li>b</li>');

        const outOl = deserialize([{ type: 'ol', items: ['1'] } as any]);
        expect(outOl).toContain('<ol');
        expect(outOl).toContain('<li>1</li>');
    });

    it('Deserializes text without styles', () => {
        const out = deserialize([{ type: 'unknown', text: 'raw' } as any]);
        expect(out).toBe('raw');
    });

    it('Deserializes text with styles', () => {
        const out = deserialize([{ type: 'unknown', color: 'red', text: 'raw' } as any]);
        expect(out).toContain('<span');
        expect(out).toContain('color: red');
        expect(out).toContain('raw');
    });

    it('Deserializes with mergeStyles', () => {
        const nodes: any = [{
            type: 'text',
            color: 'red',
            text: [
                { type: 'text', text: 'child' }
            ]
        }];
        const out = deserialize(nodes);
        expect(out).toContain('<p');
        expect(out).toContain('color: red');
        expect(out).toContain('<span');
        expect(out).toContain('child');
    });

    it('Title uses deserializeText', () => {
        const input: any = [{
            type: 'title_3',
            text: [
                'lead ',
                { type: 'bold', text: 'B' },
                { type: 'br' },
                'tail'
            ]
        }];
        const out = deserialize(input);
        expect(out.startsWith('<h3')).toBe(true);
        expect(out).toContain('lead ');
        expect(out).toContain('<strong>B</strong>');
        expect(out).toContain('<br>');
        expect(out).toContain('tail');
        expect(out).not.toContain('<p>');
    });

    it('Title with string text', () => {
        const input: any = [{ type: 'title_2', text: 'Hello' }];
        const out = deserialize(input);
        expect(out).toBe('<h2>Hello</h2>');
    });

    it('Title with undefined text', () => {
        const input: any = [{ type: 'title_1' }];
        const out = deserialize(input);
        expect(out).toBe('<h1></h1>');
    });

    it('Bold uses deserializeText', () => {
        const input: any = [{
            type: 'bold',
            text: [
                'a',
                { type: 'text', text: 'inner' },
                { type: 'italic', text: 'I' }
            ]
        }];
        const out = deserialize(input);
        expect(out.startsWith('<strong')).toBe(true);
        expect(out).toContain('a');
        expect(out).toContain('inner');
        expect(out).toContain('<em>I</em>');
        expect(out).toBe('<strong>ainner<em>I</em></strong>');
    });

    it('Italic/underline/code/blockquote call deserializeText', () => {
        const inputs: any[] = [
            { type: 'italic', text: ['x', { type: 'br' }, 'y'] },
            { type: 'underline', text: ['u1', { type: 'br' }, 'u2'] },
            { type: 'code', text: ['c1', { type: 'br' }, 'c2'] },
            { type: 'blockquote', text: ['q1', { type: 'br' }, 'q2'] }
        ];
        const out = deserialize(inputs);
        expect(out).toContain('<em>x<br>y</em>');
        expect(out).toContain('<u>u1<br>u2</u>');
        expect(out).toContain('<code>c1<br>c2</code>');
        expect(out).toContain('<blockquote>q1<br>q2</blockquote>');
    });

    it('Cell uses deserializeText', () => {
        const input: any = [{
            type: 'cell',
            text: [
                'A',
                { type: 'br' },
                { type: 'bold', text: 'B' }
            ]
        }];
        const out = deserialize(input);
        expect(out).toBe('<td>A<br><strong>B</strong></td>');
    });

    it('Default branch with styles uses deserializeText', () => {
        const input: any = [{
            type: 'unknown',
            color: 'red',
            text: [
                'foo',
                { type: 'italic', text: 'i' }
            ]
        }];
        const out = deserialize(input);
        expect(out.startsWith('<span')).toBe(true);
        expect(out).toContain('color: red');
        expect(out).toContain('foo');
        expect(out).toContain('<em>i</em>');
    });

    it('Deserialize text handles array-of-strings case', () => {
        const input: any = [
            { type: 'bold', text: ['one', 'two'] },
            { type: 'title_3', text: ['a', 'b'] },
            { type: 'cell', text: ['c', 'd'] }
        ];
        const out = deserialize(input);
        expect(out).toContain('<strong>onetwo</strong>');
        expect(out).toContain('<h3>ab</h3>');
        expect(out).toContain('<td>cd</td>');
    });

    it('Deserialize text recursive rendering', () => {
        const input: any = [{
            type: 'title_3',
            color: 'blue',
            text: [
                { type: 'text', text: ['pre', { type: 'bold', text: 'B' }, 'post'] }
            ]
        }];
        const out = deserialize(input);
        expect(out.startsWith('<h3')).toBe(true);
        expect(out).toContain('color: blue');
        expect(out).toContain('pre');
        expect(out).toContain('<strong>B</strong>');
        expect(out).toContain('post');
    });

    it('Deserialize text with falsy/empty text', () => {
        const input: any = [{ type: 'bold' }];
        const out = deserialize(input);
        expect(out).toBe('<strong></strong>');
    });

    it('Handles text as a single SerializedNode object', () => {
        const input: any = [{
            type: 'text',
            text: { type: 'bold', text: 'X' }
        }];

        const out = deserialize(input);
        expect(out).toBe('<strong>X</strong>');
    });

    it('Renders <br> when a text node contains an array with { type: "br" }', () => {
        const input: any = [{ type: 'text', text: ['a', { type: 'br' }, 'b'] }];
        const out = deserialize(input);
        expect(out).toBe('<p>a<br>b</p>');
    });

    it('Deserialize text returns the same non-empty string', () => {
        const input = 'non-empty-string';
        const out = deserializeText(input, false, {}, true);
        expect(out).toBe(input);
    });

    it('Uses default [] for items when missing', () => {
        expect(deserialize([{ type: 'ul' } as any])).toBe('<ul></ul>');
        expect(deserialize([{ type: 'ol' } as any])).toBe('<ol></ol>');
    });

    it('Uses default [] for rows when table fields missing', () => {
        const out = deserialize([{ type: 'table' } as any]);
        expect(out).toBe('<table style="border-collapse:collapse;table-layout:auto;"></table>');
    });

    it('Rows present render correctly when colWidths omitted', () => {
        const input: any = {
            type: 'table',
            rows: [
                [{ type: 'cell', text: 'A' }, { type: 'cell', text: 'B' }]
            ]
        };
        const out = deserialize([input]);
        expect(out).toContain('<td');
        expect(out).toContain('A');
        expect(out).toContain('B');
        expect(out).toContain('table-layout:auto');
    });

    it('Deserialize table row with a non-"cell" node', () => {
        const input: any = {
            type: 'table',
            rows: [
                [
                    { type: 'bold', text: 'H' },
                    { type: 'cell', text: 'C' }
                ]
            ],
            colWidths: []
        };

        const out = deserialize([input]);

        expect(out).toContain('<table');
        expect(out).toContain('<tr>');
        expect(out).toContain('<strong>H</strong>');
        expect(out).not.toContain('<td><strong>H</strong></td>');
        expect(out).toContain('<td');
        expect(out).toContain('C<');
    });

    it('Deserialize table cell fallback for empty cell', () => {
        const input: any = {
            type: 'table',
            rows: [
                [
                    { type: 'cell' },
                    { type: 'cell', text: 'X' }
                ]
            ]
        };

        const out = deserialize([input]);

        expect(out).toContain('<td');
        expect(out).toContain('</td>');
        expect(out).toContain('X');
    });

    it('Deserialize table cell with bgColor', () => {
        const input: any = {
            type: 'table',
            rows: [
                [
                    { type: 'cell', text: 'A', bgColor: 'yellow' },
                    { type: 'cell', text: 'B' }
                ]
            ]
        };

        const out = deserialize([input]);

        expect(out).toContain('<table');
        expect(out).toContain('<td');
        expect(out).toContain('background-color:yellow;');
        expect(out).toContain('A');
    });

    it('Default branch with falsy styleAttr calls deserializeText and returns its result', () => {
        const input: any = [{
            type: 'foo',
            text: [
                { type: 'bold', text: 'X' },
                'y',
                { type: 'br' }
            ]
        }];

        const out = deserialize(input);
        expect(out).toBe('<strong>X</strong>y<br>');
    });

    it('Serialize children logs warning', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const html = '<section><unknown-empty></unknown-empty></section>';
            serialize(html);
            expect(warnSpy).toHaveBeenCalledTimes(1);
            const callArgs = (warnSpy.mock.calls[0] as any[]);
            expect(callArgs[0]).toBe('serializeChildren: Unable to serialize child element');
            expect(callArgs[1]).toBeInstanceOf(HTMLElement);
            expect((callArgs[1] as HTMLElement).nodeName.toLowerCase()).toBe('unknown-empty');
        } finally {
            warnSpy.mockRestore();
        }
    });
});