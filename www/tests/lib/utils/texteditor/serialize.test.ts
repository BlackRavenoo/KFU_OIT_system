import { describe, it, expect, beforeEach, vi } from 'vitest';
import { serialize, deserialize } from '$lib/utils/texteditor/serialize';

function createDiv(html: string): HTMLDivElement {
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
    return div;
}

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
        // Сравниваем только нужные поля, игнорируя color
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

    it('serializes <font color>', () => {
        const html = '<font color="blue">Blue</font>';
        const result = serialize(html);
        expect(result[0].type).toBe('text');
        expect(result[0].color).toBe('blue');
        expect(result[0].text).toBe('Blue');
    });

    it('serializes <blockquote> and <code> with <br>', () => {
        const html = '<blockquote>Line1<br>Line2</blockquote><code>Code1<br>Code2</code>';
        const result = serialize(html);
        expect(result[0].type).toBe('blockquote');
        expect(Array.isArray(result[0].text)).toBe(true);
        expect(result[1].type).toBe('code');
        expect(Array.isArray(result[1].text)).toBe(true);
        // Check that <br> is present as {type: 'br'}
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

    it('serializes <table> with widths', () => {
        const html = '<table><tr><td style="width:50px">A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>';
        const result = serialize(html);
        expect(result[0].type).toBe('table');
        expect(result[0].rows.length).toBe(2);
        expect(result[0].rows[0][0].width).toBe('50px');
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
});