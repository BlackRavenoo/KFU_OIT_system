import { api } from '$lib/utils/api';

export interface RelatedItem {
    id: string;
    title: string;
}

const RelatedRoute = '/api/v1/related/';

/**
 * Функция для получения списка связанных материалов (страниц) по поисковому запросу.
 * @param {string} query - поисковая строка.
 * @returns {Promise<RelatedItem[]>} Массив найденных связанных материалов.
 */
export async function fetchRelated(query: string): Promise<RelatedItem[]> {
    const q = (query ?? '').trim();
    if (!q) return [];
    try {
        const res: any = await api.get(`${RelatedRoute}?q=${encodeURIComponent(q)}`);
        const data = res?.data;

        const list: any[] = Array.isArray(data)
            ? (data as any[])
            : (Array.isArray((data as any)?.results) ? (data as any).results : []);

        return list
            .filter((p) => p && (p.id || p.uuid) && (p.title || p.name))
            .map((p) => ({ id: String(p.id ?? p.uuid), title: String(p.title ?? p.name) }));
    } catch {
        return [];
    }
}

/**
 * Функция для добавления связанного материала в список выбранных.
 * Добавляет элемент только если его ещё нет в списке.
 * @param {RelatedItem[]} selected - текущий список выбранных связанных материалов.
 * @param {RelatedItem | undefined} item - элемент для добавления.
 * @returns {RelatedItem[]} Новый массив выбранных связанных материалов.
 */
export function addRelated(selected: RelatedItem[], item?: RelatedItem): RelatedItem[] {
    if (!item) return selected;
    if (selected.some((s) => s.id === item.id)) return selected;
    return [...selected, item];
}

/**
 * Функция для удаления связанного материала из списка выбранных по идентификатору.
 * @param {RelatedItem[]} selected - текущий список выбранных связанных материалов.
 * @param {string} id - идентификатор элемента для удаления.
 * @returns {RelatedItem[]} Новый массив без удалённого элемента.
 */
export function removeRelated(selected: RelatedItem[], id: string): RelatedItem[] {
    return selected.filter((r) => r.id !== id);
}

/**
 * Создаёт дебаунс-обёртку для функции поиска связанных материалов.
 * Возвращает функцию, которую можно вызывать при вводе текста.
 * @param {(q: string) => void | Promise<void>} callback - колбэк, выполняющий поиск.
 * @param {number} [delay=250] - задержка перед вызовом колбэка, мс.
 * @returns {(q: string) => void} Дебаунс-функция.
 */
export function createDebouncedRelatedSearch(
    callback: (q: string) => void | Promise<void>,
    delay = 250
): (q: string) => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (q: string) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void callback(q), delay);
    };
}