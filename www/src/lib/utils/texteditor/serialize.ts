type SerializedNode = {
    type: string;
    text?: string | SerializedNode[];
    align?: 'left' | 'center' | 'right' | 'justify';
    color?: string;
    bgColor?: string;
    [key: string]: any;
};

/**
 * Получает стили элемента (выравнивание, цвет текста, цвет фона)
 */
function getNodeStyles(node: HTMLElement): { align?: 'left' | 'center' | 'right' | 'justify'; color?: string; bgColor?: string } {
    const styles: { align?: 'left' | 'center' | 'right' | 'justify'; color?: string; bgColor?: string } = {};
    const inlineStyle = node.style;
    
    if (inlineStyle.textAlign && ['left', 'center', 'right', 'justify'].includes(inlineStyle.textAlign))
        styles.align = inlineStyle.textAlign as 'left' | 'center' | 'right' | 'justify';
    if (inlineStyle.color) styles.color = inlineStyle.color;
    if (inlineStyle.backgroundColor) styles.bgColor = inlineStyle.backgroundColor;
    
    const computedStyle = window.getComputedStyle(node);
    
    if (!styles.align) {
        const textAlign = computedStyle.textAlign;
        if (['left', 'center', 'right', 'justify'].includes(textAlign))
            styles.align = textAlign as 'left' | 'center' | 'right' | 'justify';
    }
    if (!styles.color) {
        const color = computedStyle.color;
        if (color && color !== 'rgb(0, 0, 0)' && color !== 'rgba(0, 0, 0, 1)')
            styles.color = color;
    }
    if (!styles.bgColor) {
        const bgColor = computedStyle.backgroundColor;
        if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent')
            styles.bgColor = bgColor;
    }

    return styles;
}

/**
 * Преобразует блочные переносы (div, p) в <br> для корректной сериализации переносов строк
 */
function normalizeLineBreaks(html: string): string {
    return html
        .replace(/<div>(.*?)<\/div>/gis, (m, content) => {
            if (/<(div|p|ul|ol|table|h[1-6]|blockquote|pre)[\s>]/i.test(content)) return m;
            return content + '<br>';
        })
        .replace(/<p>(.*?)<\/p>/gis, (m, content) => {
            if (/<(div|p|ul|ol|table|h[1-6]|blockquote|pre)[\s>]/i.test(content)) return m;
            return content + '<br>';
        });
}

/**
 * Обрабатывает дочерние узлы и возвращает массив сериализованных элементов
 * Сохраняет переносы строк как отдельные объекты { type: 'br' }
 */
function serializeChildren(node: Node): SerializedNode[] | string {
    const result: (string | SerializedNode)[] = [];
    node.childNodes.forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent || '';
            if (text) result.push(text);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            const element = child as HTMLElement;
            if (element.nodeName.toLowerCase() === 'br') {
                result.push({ type: 'br' });
            } else {
                const serialized = serializeNode(element);
                if (serialized) result.push(serialized);
            }
        }
    });

    if (result.length === 1 && typeof result[0] === 'string') return result[0];
    if (result.length === 0) return '';
    if (result.every(item => typeof item !== 'string')) return result as SerializedNode[];
    
    return result.map(item => typeof item === 'string' ? { type: 'text', text: item } : item) as SerializedNode[];
}

/**
 * Сериализует один узел DOM в объект
 */
function serializeNode(node: HTMLElement): SerializedNode | null {
    const nodeName = node.nodeName.toLowerCase();
    const styles = getNodeStyles(node);

    switch (nodeName) {
        case 'h1':
        case 'h2':
        case 'h3':
            return {
                type: `title_${nodeName[1]}`,
                ...(styles.align ? { align: styles.align } : {}),
                ...(styles.color ? { color: styles.color } : {}),
                ...(styles.bgColor ? { bgColor: styles.bgColor } : {}),
                text: serializeChildren(node)
            };
        case 'p':
        case 'div':
        case 'pre':
        case 'section':
        case 'article':
        case 'aside':
        case 'header':
        case 'footer':
        case 'main':
        case 'nav':
            const children = serializeChildren(node);
            return {
                type: 'text',
                ...(styles.align ? { align: styles.align } : {}),
                ...(styles.color ? { color: styles.color } : {}),
                ...(styles.bgColor ? { bgColor: styles.bgColor } : {}),
                text: children || ''
            };
        case 'b':
        case 'strong':
            return {
                type: 'bold',
                ...(styles.align ? { align: styles.align } : {}),
                ...(styles.color ? { color: styles.color } : {}),
                ...(styles.bgColor ? { bgColor: styles.bgColor } : {}),
                text: serializeChildren(node)
            };
        case 'i':
        case 'em':
            return {
                type: 'italic',
                ...(styles.align ? { align: styles.align } : {}),
                ...(styles.color ? { color: styles.color } : {}),
                ...(styles.bgColor ? { bgColor: styles.bgColor } : {}),
                text: serializeChildren(node)
            };
        case 'u':
            return {
                type: 'underline',
                ...(styles.align ? { align: styles.align } : {}),
                ...(styles.color ? { color: styles.color } : {}),
                ...(styles.bgColor ? { bgColor: styles.bgColor } : {}),
                text: serializeChildren(node)
            };
        case 'span':
            const spanChildren = serializeChildren(node);
            if (styles.align || styles.color || styles.bgColor) {
                return {
                    type: 'text',
                    ...(styles.align ? { align: styles.align } : {}),
                    ...(styles.color ? { color: styles.color } : {}),
                    ...(styles.bgColor ? { bgColor: styles.bgColor } : {}),
                    text: spanChildren
                };
            }
            if (spanChildren) {
                if (typeof spanChildren === 'string') return null;
                return {
                    type: 'text',
                    text: spanChildren
                };
            }
            return null;
        case 'font':
            const fontChildren = serializeChildren(node);
            const fontStyles: any = { ...styles };
            if (node.hasAttribute('color')) fontStyles.color = node.getAttribute('color');
            return {
                type: 'text',
                ...(fontStyles.align ? { align: fontStyles.align } : {}),
                ...(fontStyles.color ? { color: fontStyles.color } : {}),
                ...(fontStyles.bgColor ? { bgColor: fontStyles.bgColor } : {}),
                text: fontChildren
            };
        case 'blockquote':
            return {
                type: 'blockquote',
                ...(styles.align ? { align: styles.align } : {}),
                ...(styles.color ? { color: styles.color } : {}),
                ...(styles.bgColor ? { bgColor: styles.bgColor } : {}),
                text: serializeChildren(node)
            };
        case 'code':
            return {
                type: 'code',
                ...(styles.align ? { align: styles.align } : {}),
                ...(styles.color ? { color: styles.color } : {}),
                ...(styles.bgColor ? { bgColor: styles.bgColor } : {}),
                text: serializeChildren(node)
            };
        case 'ul':
        case 'ol':
            const items: string[] = [];
            node.querySelectorAll(':scope > li').forEach(li => {
                items.push(li.textContent || '');
            });
            return {
                type: nodeName,
                ...(styles.align ? { align: styles.align } : {}),
                ...(styles.color ? { color: styles.color } : {}),
                ...(styles.bgColor ? { bgColor: styles.bgColor } : {}),
                items: items
            };
        case 'table':
            const rows: any[] = [];
            node.querySelectorAll('tr').forEach(tr => {
                const cells: SerializedNode[] = [];
                tr.querySelectorAll('td, th').forEach(cell => {
                    const cellElement = cell as HTMLElement;
                    const cellStyles = getNodeStyles(cellElement);
                    cells.push({
                        type: 'cell',
                        ...(cellStyles.align ? { align: cellStyles.align } : {}),
                        ...(cellStyles.color ? { color: cellStyles.color } : {}),
                        ...(cellStyles.bgColor ? { bgColor: cellStyles.bgColor } : {}),
                        width: cellElement.style.width || undefined,
                        text: cellElement.innerHTML
                    });
                });
                rows.push(cells);
            });
            const colWidths: (string | undefined)[] = [];
            const firstRow = node.querySelector('tr');
            if (firstRow) {
                firstRow.querySelectorAll('td, th').forEach(cell => {
                    colWidths.push((cell as HTMLElement).style.width || undefined);
                });
            }
            return {
                type: 'table',
                ...(styles.align ? { align: styles.align } : {}),
                ...(styles.color ? { color: styles.color } : {}),
                ...(styles.bgColor ? { bgColor: styles.bgColor } : {}),
                rows: rows,
                colWidths: colWidths
            };
        case 'br':
            return { type: 'br' };
        default:
            const defaultChildren = serializeChildren(node);
            if (defaultChildren || styles.align || styles.color || styles.bgColor) {
                return {
                    type: 'text',
                    ...(styles.align ? { align: styles.align } : {}),
                    ...(styles.color ? { color: styles.color } : {}),
                    ...(styles.bgColor ? { bgColor: styles.bgColor } : {}),
                    text: defaultChildren
                };
            }
            return null;
    }
}

/**
 * Сериализует HTML из редактора в JSON формат
 * @param html - HTML строка из contentEditable div
 * @returns Массив сериализованных узлов
 */
export function serialize(html: string): SerializedNode[] {
    html = normalizeLineBreaks(html);
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const result: SerializedNode[] = [];
    tempDiv.childNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const serialized = serializeNode(node as HTMLElement);
            if (serialized) result.push(serialized);
        } else if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            if (text) result.push({ type: 'text', text });
        }
    });
    return result;
}

function mergeStyles(parent: SerializedNode, child: SerializedNode): SerializedNode {
    return {
        ...child,
        color: child.color ?? parent.color,
        bgColor: child.bgColor ?? parent.bgColor,
        align: child.align ?? parent.align,
    };
}

function deserializeNode(
    node: SerializedNode,
    insideParagraph: boolean = false,
    parentStyles: Partial<SerializedNode> = {},
    isRoot = true
): string {
    const { type, text, align, color, bgColor, ...rest } = node;
    const styles: string[] = [];
    if (align) styles.push(`text-align: ${align}`);
    if (color) styles.push(`color: ${color}`);
    if (bgColor) styles.push(`background-color: ${bgColor}`);
    const styleAttr = styles.length > 0 ? ` style="${styles.join('; ')}"` : '';

    if (type === 'text' && (!text || (Array.isArray(text) && text.length === 0))) return '';
    if (type === 'br') return '<br>';

    switch (type) {
        case 'title_1':
        case 'title_2':
        case 'title_3':
            const level = type.split('_')[1];
            return `<h${level}${styleAttr}>${typeof text === 'string' ? text : deserializeText(text, false, node, false)}</h${level}>`;
        case 'text': {
            let inner = '';
            if (typeof text === 'string') {
                inner = text;
            } else if (Array.isArray(text)) {
                inner = text.map(child => {
                    if (typeof child === 'string') return child;
                    if (child.type === 'text') {
                        return deserializeNode(mergeStyles(node, child), true, node, false);
                    }
                    if (child.type === 'br') return '<br>';
                    return deserializeNode(child, true, node, false);
                }).join('');
            }
            
            return isRoot ? `<p${styleAttr}>${inner}</p>` : styleAttr ? `<span${styleAttr}>${inner}</span>` : inner;
        }
        case 'bold':
            return `<strong${styleAttr}>${typeof text === 'string' ? text : deserializeText(text, true, node, false)}</strong>`;
        case 'italic':
            return `<em${styleAttr}>${typeof text === 'string' ? text : deserializeText(text, true, node, false)}</em>`;
        case 'underline':
            return `<u${styleAttr}>${typeof text === 'string' ? text : deserializeText(text, true, node, false)}</u>`;
        case 'blockquote':
            return `<blockquote${styleAttr}>${typeof text === 'string' ? text : deserializeText(text, false, node, false)}</blockquote>`;
        case 'code':
            return `<code${styleAttr}>${typeof text === 'string' ? text : deserializeText(text, false, node, false)}</code>`;
        case 'ul':
        case 'ol':
            const items = (rest as any).items || [];
            const listItems = items.map((item: string) => `<li>${item}</li>`).join('');
            return `<${type}${styleAttr}>${listItems}</${type}>`;
        case 'table':
            const rows = (rest as any).rows || [];
            const colWidths = (rest as any).colWidths || [];
            const tableRows = rows.map((row: SerializedNode[], rowIdx: number) => {
                const cells = row.map((cell, colIdx) => {
                    let cellHtml = '';
                    if (cell.type === 'cell') {
                        let widthStyle = '';
                        if (colWidths[colIdx] && typeof colWidths[colIdx] === 'string') widthStyle = `width:${colWidths[colIdx]};`;
                        let resizerHtml = '';
                        if (rowIdx === 0)
                            resizerHtml = `<div class="col-resizer" style="position:absolute;right:0;top:0;width:6px;height:100%;cursor:col-resize;user-select:none;z-index:2;transform:translateX(50%);"></div>`;
                        cellHtml = `<td style="${widthStyle}${cell.color ? `color:${cell.color};` : ''}${cell.bgColor ? `background-color:${cell.bgColor};` : ''}position:relative;">${cell.text || ''}${resizerHtml}</td>`;
                    }
                    return cellHtml;
                }).join('');
                return `<tr>${cells}</tr>`;
            }).join('');
            return `<table style="border-collapse:collapse;table-layout:${colWidths.some((w: any) => typeof w === 'string' && w) ? 'fixed' : 'auto'};">${tableRows}</table>`;
        case 'cell':
            return `<td${styleAttr}>${typeof text === 'string' ? text : deserializeText(text, true, node, false)}</td>`;
        default:
            if (styleAttr) return `<span${styleAttr}>${typeof text === 'string' ? text : deserializeText(text, true, node, false)}</span>`;
            return typeof text === 'string' ? text : deserializeText(text, true, node, false);
    }
}

function deserializeText(
    text: string | SerializedNode[] | undefined,
    insideParagraph: boolean,
    parentStyles: Partial<SerializedNode>,
    isRoot: boolean
): string {
    if (!text) return '';
    if (typeof text === 'string') return text;
    return text.map(item => {
        if (typeof item === 'string') return item;
        return deserializeNode(item, insideParagraph, parentStyles, false);
    }).join('');
}

/**
 * Десериализует массив JSON узлов обратно в HTML
 * @param nodes - Массив сериализованных узлов
 * @returns HTML строка
 */
export function deserialize(nodes: SerializedNode[]): string {
    return nodes.map(node => deserializeNode(node, false, {}, true)).join('');
}