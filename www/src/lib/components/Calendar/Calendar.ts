import { fetchTickets } from '$lib/utils/tickets/api/get';
import { normalizeDate } from '$lib/utils/tickets/support';
import type { Ticket } from '$lib/utils/tickets/types';

/**
 * Преобразует дату в строку формата DD-MM-YYYY
 * @param d Дата
 * @returns Строка формата DD-MM-YYYY
 */
export function toKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${dd}-${m}-${y}`;
}

/**
 * Получает диапазон дат для недели, в которой находится заданная дата
 * @param center Дата внутри недели
 * @returns Объект с началом и концом недели
 */
export function getWeekRange(center: Date): { start: Date; end: Date } {
    const d = new Date(center);
    const day = d.getDay();
    const diffToMon = (day + 6) % 7;
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    start.setDate(d.getDate() - diffToMon);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

/** 
 * Строит массив дат в заданном диапазоне
 * @param start Начальная дата
 * @param end Конечная дата
 * @returns Массив дат
 */
export function buildDays(start: Date, end: Date): Date[] {
    const arr: Date[] = [];
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    while (cur <= end) {
        arr.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return arr;
}

/**
 * Загружает тикеты, запланированные в заданном диапазоне дат
 * @param startDate Начальная дата
 * @param endDate Конечная дата
 * @returns Объект с массивами тикетов, сгруппированными по датам
 */
export async function loadTicketsForRange(startDate: Date, endDate: Date): Promise<Record<string, Ticket[]>> {
    const ticketsByDate: Record<string, Ticket[]> = {};
    const opts: any = {
        planned_from: startDate.toISOString(),
        planned_to: endDate.toISOString(),
        page_size: 100
    };
    const res = await fetchTickets('', opts);
    const list: Ticket[] = Array.isArray(res?.tickets) ? res.tickets : [];
    for (const t of list) {
        const raw = t.planned_at || t.created_at || '';
        const norm = normalizeDate(String(raw));
        if (!norm) continue;
        const d = new Date(norm);
        if (isNaN(d.getTime())) continue;
        const key = toKey(d);
        ticketsByDate[key] = ticketsByDate[key] || [];
        ticketsByDate[key].push(t);
    }
    return ticketsByDate;
}