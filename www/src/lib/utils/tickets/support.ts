/**
 * Нормализует дату в формате ISO 8601.
 * Вывод строго в UTC без таймзоны.
 * @param {string} date - Дата в строковом формате.
 */
export function normalizeDate(date: string): string | null {
    if (!date || !date.trim()) return null;
    const s = date.trim();

    const mDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (mDate) {
        const [, y, mo, d] = mDate.map(Number) as unknown as [number, number, number, number];
        const iso = new Date(y, mo - 1, d, 0, 0, 0).toISOString();
        return iso.replace(/\.\d{3}Z$/, 'Z');
    }

    const mLocal = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
    if (mLocal && !/[Zz]|[+-]\d{2}:\d{2}$/.test(s)) {
        const [, yS, moS, dS, hS, miS, sS] = mLocal;
        const y = Number(yS), mo = Number(moS), d = Number(dS);
        const h = Number(hS), mi = Number(miS), sec = sS ? Number(sS) : 0;
        const iso = new Date(y, mo - 1, d, h, mi, sec).toISOString();
        return iso.replace(/\.\d{3}Z$/, 'Z');
    }

    const withTz = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})$/.exec(s);
    if (withTz) {
        const hasSeconds = !!withTz[6];
        const normalized = s.replace(' ', 'T').replace(/(T\d{2}:\d{2})(Z|[+-]\d{2}:\d{2})$/, hasSeconds ? '$1$2' : '$1:00$2');
        const d = new Date(normalized);
        if (!isNaN(d.getTime())) return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
        return null;
    }

    const d = new Date(s.replace(' ', 'T'));
    if (!isNaN(d.getTime())) return d.toISOString().replace(/\.\d{3}Z$/, 'Z');

    return null;
}

/**
 * Преобразует строку даты в формат RFC3339
 * @param dateStr - строка даты
 * @param endOfDay - если true, устанавливает время на конец дня (23:59:59)
 * @returns строка в формате RFC3339 или пустую строку для невалидных дат
 */
export function toRfc3339(dateStr: string, endOfDay = false): string {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    
    const formattedDate = dateStr.includes('T') 
        ? dateStr.split('T')[0] 
        : dateStr;
    
    return endOfDay
        ? `${formattedDate}T23:59:59Z`
        : `${formattedDate}T00:00:00Z`;
}

/**
 * Создаёт строку запроса из объекта параметров
 * @param params - объект параметров
 */
export function buildQuery(params: Record<string, any>) {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value))
            value.forEach(v => parts.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(v)}`));
        else
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }

    return parts.join('&');
}