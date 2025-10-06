import { notification, NotificationType } from "../notifications/notification";

/**
 * Нормализует дату в формате ISO 8601.
 * @param {string} date - Дата в строковом формате.
 */
export function normalizeDate(date: string): string | null {
    if (!date || !date.trim()) return null;
    if (/T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?$/.test(date)) return date;
    return date + ':00Z';
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