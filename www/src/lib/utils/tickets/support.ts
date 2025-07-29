/**
 * Преобразует строку даты в формат "ДД.ММ.ГГГГ ЧЧ:ММ"
 * @param dateStr - строка даты
 */
export function formatDate(dateStr: string): string {
    if (!dateStr) return 'Без даты';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Без даты';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Преобразует строку даты в формат RFC3339
 * @param dateStr - строка даты
 * @param endOfDay - если true, устанавливает время на конец дня (23:59:59)
 */
export function toRfc3339(dateStr: string, endOfDay = false) {
    if (!dateStr) return '';
    return endOfDay
        ? `${dateStr}T23:59:59Z`
        : `${dateStr}T00:00:00Z`;
}

/**
 * Создаёт строку запроса из объекта параметров
 * @param params - объект параметров
 */
export function buildQuery(params: Record<string, any>) {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
            value.forEach(v => parts.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(v)}`));
        } else {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        }
    }
    return parts.join('&');
}