import { fetchTickets } from '$lib/utils/tickets/api/get';
import type { Ticket } from '$lib/utils/tickets/types';
import { currentUser } from '$lib/utils/auth/storage/initial';

import { get } from 'svelte/store';

/**
 * Генерация и скачивание отчёта по заявкам в Excel
 * @param fromDate - дата начала периода (включительно) в формате 'YYYY-MM-DD'
 * @param toDate - дата окончания периода (включительно) в формате 'YYYY-MM-DD'
 */
export async function generateStatisticsReport(
    fromDate: string,
    toDate: string
): Promise<void> {
    // @ts-ignore
    const { saveAs } = await import('file-saver');
    const XLSX = await import('xlsx-js-style');

    const resultTickets: Ticket[] = [];
    let page = 1;
    const page_size = 100;

    const fromDateObj = new Date(fromDate);
    fromDateObj.setHours(0, 0, 0, 0);
    const fromMs = fromDateObj.getTime();

    const toDateObj = new Date(toDate);
    toDateObj.setHours(23, 59, 59, 999);
    const toMs = toDateObj.getTime();

    let reachedEnd = false;

    while (!reachedEnd) {
        const response = await fetchTickets('', {
            page,
            page_size,
            order_by: '0',
            sort_order: 'desc',
            search: ''
        });

        const tickets = response.tickets ?? [];
        const max_page = response.max_page ?? 1;
        if (!tickets.length) break;

        for (const ticket of tickets) {
            const createdMs = new Date(ticket.created_at).getTime();
            if (createdMs >= fromMs && createdMs <= toMs) {
                resultTickets.push(ticket);
            } else if (createdMs < fromMs) {
                reachedEnd = true;
                break;
            } else {
                continue;
            }
        }

        if (page >= max_page) break;
        page++;
    }

    const statusMap: Record<string, string> = {
        open: 'Открыт',
        inprogress: 'В работе',
        closed: 'Выполнено',
        cancelled: 'Отменено'
    };
    const statusCounts: Record<string, number> = {
        'Открыт': 0,
        'В работе': 0,
        'Выполнено': 0,
        'Отменено': 0
    };
    resultTickets.forEach(ticket => {
        const status = statusMap[ticket.status] ?? ticket.status;
        if (statusCounts[status] !== undefined) statusCounts[status]++;
    });

    const performerCounts: Record<string, number> = {};
    resultTickets.forEach(ticket => {
        let names: string[] = [];
        if (Array.isArray(ticket.assigned_to)) {
            names = ticket.assigned_to.map((a: any) => a.name);
        } else if (ticket.assigned_to) {
            names = [ticket.assigned_to];
        }
        names.forEach(name => {
            if (!name) return;
            else performerCounts[name] = (performerCounts[name] ?? 0) + 1;
        });
    });

    const user = get(currentUser);
    const author = user?.name ?? 'Неизвестно';

    function formatDate(dateStr: string) {
        const d = new Date(dateStr);
        return d.toLocaleString('ru-RU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    const header = [
        'ID',
        'Заголовок',
        'Описание',
        'Кабинет',
        'Дата создания',
        'Исполнители',
        'Статус',
    ];

    const rows = resultTickets.map((ticket) => [
        ticket.id?.toString() ?? '',
        ticket.title ?? '',
        ticket.description ?? '',
        `${ticket.building?.name ?? ''}, ${ticket.cabinet ?? ''}`.trim(),
        formatDate(ticket.created_at),
        Array.isArray(ticket.assigned_to)
            ? ticket.assigned_to.map((a: any) => a.name).join(', ')
            : ticket.assigned_to ?? ticket.assigned_to ?? '',
        statusMap[ticket.status] ?? ticket.status,
    ]);

    const statBlock = [
        ['Статистика по статусам', '', '', 'Статистика по исполнителям', '', ''],
    ];
    const statRows = [
        ['Открыт', statusCounts['Открыт'], '', 'Статистика по исполнителям', '', ''],
        ['В работе', statusCounts['В работе'], '', '', '', ''],
        ['Выполнено', statusCounts['Выполнено'], '', '', '', ''],
        ['Отменено', statusCounts['Отменено'], '', '', '', '']
    ];

    const performerBlock: any[][] = [];
    Object.entries(performerCounts).forEach(([name, count], idx) => {
        if (idx < statRows.length) {
            statRows[idx][3] = name;
            statRows[idx][4] = count;
        } else {
            statRows.push(['', '', '', name, count, '']);
        }
    });

    const now = new Date();
    const paramBlock = [
        ['Параметры отчёта', ''],
        ['Период', `${fromDateObj.toLocaleDateString('ru-RU')} — ${toDateObj.toLocaleDateString('ru-RU')}`],
        ['Дата формирования', formatDate(now.toISOString())],
        ['Сформировал', author]
    ];

    const excelData: any[][] = [
        header,
        ...rows,
        [],
        ...statBlock,
        ...statRows,
        [],
    ];
    paramBlock.forEach(row => excelData.push(row));

    const worksheet = XLSX.utils.aoa_to_sheet(excelData);

    worksheet['!cols'] = [
        { wch: 10 },
        { wpx: 220 },
        { wpx: 400 },
        { wch: 24 },
        { wch: 24 },
        { wch: 18 },
        { wch: 14 },
        { wpx: 220 },
        { wch: 22 },
        { wch: 10 }
    ];

    worksheet['!rows'] = Array(excelData.length).fill({ hpt: 22 });

    // --- стилизация первой строки ---
    for (let c = 0; c < header.length; c++) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c })];
        if (cell) {
            cell.s = {
                font: {
                    name: "Times New Roman",
                    bold: true
                },
                fill: {
                    patternType: "solid",
                    fgColor: { rgb: "E3F2FD" }
                },
                alignment: {
                    horizontal: "center",
                    vertical: "center",
                    wrapText: true
                },
                border: {
                    top: { style: "thin", color: { rgb: "000000" } },
                    bottom: { style: "thin", color: { rgb: "000000" } },
                    left: { style: "thin", color: { rgb: "000000" } },
                    right: { style: "thin", color: { rgb: "000000" } }
                }
            };
        } else {
            console.warn(`Cell at (0, ${c}) not found for header styling.`);
        }
    }

    // --- объединение ячеек для заголовков таблиц ---
    const statHeaderRow = rows.length + 2;
    worksheet['!merges'] = [
        { s: { r: statHeaderRow, c: 0 }, e: { r: statHeaderRow, c: 1 } },
        { s: { r: statHeaderRow, c: 3 }, e: { r: statHeaderRow, c: 4 } }
    ];

    // --- стилизация объединённых заголовков ---
    for (const col of [0, 3]) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: statHeaderRow, c: col })];
        if (cell) {
            cell.s = {
                font: {
                    name: "Times New Roman",
                    bold: true
                },
                fill: {
                    patternType: "solid",
                    fgColor: { rgb: "E3F2FD" }
                },
                alignment: {
                    horizontal: "center",
                    vertical: "center",
                    wrapText: true
                },
                border: {
                    top: { style: "thin", color: { rgb: "000000" } },
                    bottom: { style: "thin", color: { rgb: "000000" } },
                    left: { style: "thin", color: { rgb: "000000" } },
                    right: { style: "thin", color: { rgb: "000000" } }
                }
            };
        } else {
            console.warn(`Cell at (${statHeaderRow}, ${col}) not found for stats header styling.`);
        }
    }

    // --- параметры отчёта: объединение и стилизация ---
    const paramHeaderRow = excelData.findIndex(row => row[0] === 'Параметры отчёта');
    worksheet['!merges'].push({ s: { r: paramHeaderRow, c: 0 }, e: { r: paramHeaderRow, c: 1 } });
    const paramCell = worksheet[XLSX.utils.encode_cell({ r: paramHeaderRow, c: 0 })];
    if (paramCell) {
        paramCell.s = {
            font: {
                name: "Times New Roman",
                bold: true
            },
            fill: {
                patternType: "solid",
                fgColor: { rgb: "E3F2FD" }
            },
            alignment: {
                horizontal: "center",
                vertical: "center",
                wrapText: true
            },
            border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } }
            }
        };
    } else {
        console.warn(`Cell at (${paramHeaderRow}, 0) not found for parameters header styling.`);
    }

    // --- перенос текста и авто-высота строк ---
    const range = XLSX.utils.decode_range(worksheet['!ref']!);
    for (let R = 0; R <= range.e.r; ++R) {
        let maxLen = 0;
        for (let C = 0; C <= range.e.c; ++C) {
            const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
            if (cell && cell.v) {
                cell.s = cell.s || {};
                cell.s.alignment = { ...cell.s.alignment, wrapText: true, vertical: "top" };
                const text = cell.v.toString();
                if (text.length > maxLen) maxLen = text.length;
                else {
                    const lineBreaks = text.split('\n').length;
                    if (lineBreaks > 1 && lineBreaks * 30 > maxLen) maxLen = lineBreaks * 30;
                    else maxLen = text.length;
                }
            }
        }
        if (maxLen > 60) {
            worksheet['!rows'][R] = { hpt: 22 + Math.ceil(maxLen / 60) * 12 };
        } else {
            worksheet['!rows'][R] = { hpt: 22 };
        }
    }

    // --- центрирование ID заявки ---
    for (let R = 1; R <= rows.length; ++R) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: 0 })];
        if (cell) {
            cell.s = cell.s || {};
            cell.s.alignment = { ...cell.s.alignment, horizontal: "center", wrapText: true, vertical: "top" };
        }
    }

    // --- красный фон для строк со статусом "Отменено" ---
    for (let R = 1; R <= rows.length; ++R) {
        const statusCell = worksheet[XLSX.utils.encode_cell({ r: R, c: 6 })];
        if (statusCell && statusCell.v === 'Отменено') {
            for (let C = 0; C < header.length; ++C) {
                const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
                if (cell) {
                    cell.s = cell.s || {};
                    cell.s.fill = { patternType: "solid", fgColor: { rgb: "FFC7CE" } };
                }
            }
        }
    }

    const afterRowsStart = rows.length + 1;
    for (let R = afterRowsStart; R <= range.e.r; ++R) {
        for (const C of [2, 5]) {
            const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
            if (cell) {
                cell.s = cell.s || {};
                cell.s.border = undefined;
            } else {
                console.warn(`Cell at (${R}, ${C}) not found for border removal.`);
            }
        }
    }

    // --- остальные ячейки ---
    for (let R = 0; R <= range.e.r; ++R) {
        for (let C = 0; C <= range.e.c; ++C) {
            if (R >= afterRowsStart && (C === 2 || C === 5)) continue;
            const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
            if (cell && !cell.s?.border) {
                cell.s = cell.s || {};
                cell.s.border = {
                    top: { style: "thin", color: { rgb: "000000" } },
                    bottom: { style: "thin", color: { rgb: "000000" } },
                    left: { style: "thin", color: { rgb: "000000" } },
                    right: { style: "thin", color: { rgb: "000000" } }
                };
            }
        }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Отчёт');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `statistic_${fromDate}_${toDate}.xlsx`);
}