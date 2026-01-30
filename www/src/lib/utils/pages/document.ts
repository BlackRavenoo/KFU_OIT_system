import { api } from '$lib/utils/api';
import { serialize } from '$lib/utils/texteditor/serialize';
import { deserialize } from '$lib/utils/texteditor/serialize';
import type { PageData } from '../../../routes/page/[id]/$types';

export interface SavePageRequest {
    html: string;
    title: string;
    tags: number[];
    related: number[];
    is_public?: boolean;
}

export interface SavePageCreated {
    id: string;
    [k: string]: unknown;
}

const PagesRoute = '/api/v1/pages/';

/**
 * Сохраняет страницу на сервере.
 * @param req Объект с параметрами страницы: html, title, tags, related, is_public
 * @returns Объект с данными созданной страницы (минимум { id })
 * @throws Error если сервер вернул ошибку или некорректный ответ
 */
export async function savePage(req: SavePageRequest): Promise<SavePageCreated> {
    const serializedData = serialize(req.html);

    const tags = Array.from(
        new Set((req.tags ?? []).map((t) => Number(t)).filter((n) => Number.isInteger(n) && n > 0))
    );
    const related = Array.from(
        new Set((req.related ?? []).map((r) => Number(r)).filter((n) => Number.isInteger(n) && n > 0))
    );

    const payload = {
        data: serializedData,
        title: req.title,
        tags,
        related,
        is_public: req.is_public ?? false
    };

    const response: any = await api.post(PagesRoute, payload);
    if (!response || typeof response.status !== 'number' || (response.status !== 200 && response.status !== 201))
        throw new Error('Failed to save page');

    const data = response.data as SavePageCreated | undefined;
    if (!data || !data.id)
        throw new Error('Invalid server response: missing id');

    return data;
}

/**
 * Сохраняет страницу и возвращает её идентификатор.
 * @param req Параметры сохраняемой страницы
 * @returns Строковый идентификатор созданной страницы
 * @throws Error пробрасывает ошибку из savePage
 */
export async function savePageAndGetId(req: SavePageRequest): Promise<string> {
    const created = await savePage(req);
    return created.id;
}

/**
 * Функция для получения контента страницы по её ключу.
 * @param data Объект с данными страницы
 * @returns HTML-строка для вставки в документ
 * @throws Error если формат ответа некорректный или сервер вернул ошибку
 */
export async function fetchPageContentByKey(data: PageData): Promise<string> {
    // @ts-ignore
    let arr: unknown = data.text;
    if (Array.isArray(arr))
        return deserialize(arr as any);
    if (typeof arr === 'string') {
        try {
            const parsed = JSON.parse(arr);
            if (Array.isArray(parsed)) return deserialize(parsed as any);
            else return arr as any;
        } catch {
            return arr as any;
        }
    }
    throw new Error('Некорректный формат контента');
}

/**
 * Вычисляет разницу между двумя массивами идентификаторов.
 * @param current Текущие идентификаторы на сервере
 * @param desired Желаемые идентификаторы после обновления
 * @returns Объект с массивами toAdd и toDelete
 */
export function computeDiff(current: number[], desired: number[]): { toAdd: number[]; toDelete: number[] } {
    const currentSet = new Set(current);
    const desiredSet = new Set(desired);

    const toAdd = desired.filter(id => !currentSet.has(id));
    const toDelete = current.filter(id => !desiredSet.has(id));

    return { toAdd, toDelete };
}

/**
 * Обновляет страницу по идентификатору.
 * Запрашивает текущие данные страницы с сервера, вычисляет разницу
 * между текущими и желаемыми тегами/связями и отправляет только изменения.
 * @param id Идентификатор страницы
 * @param req Параметры страницы: html, title, tags, related, is_public
 * @returns Promise<void>
 * @throws Error если сервер вернул ошибку или некорректный ответ
 */
export async function updatePage(id: string, req: SavePageRequest): Promise<void> {
    const serializedData = serialize(req.html);

    const desiredTags = Array.from(
        new Set((req.tags ?? []).map((t) => Number(t)).filter((n) => Number.isInteger(n) && n > 0))
    );
    const desiredRelated = Array.from(
        new Set((req.related ?? []).map((r) => Number(r)).filter((n) => Number.isInteger(n) && n > 0))
    );

    const pageResp = await api.get<{ tags?: { id: number }[]; related?: { id: number }[] }>(`${PagesRoute}${encodeURIComponent(id)}`);
    const pageOk = pageResp.status === 200 || pageResp.status === 201 || pageResp.status === 304;
    
    let currentTags: number[] = [];
    let currentRelated: number[] = [];
    
    if (pageOk && pageResp.data) {
        currentTags = pageResp.data.tags?.map(t => t.id) ?? [];
        currentRelated = pageResp.data.related?.map(r => r.id) ?? [];
    } else console.warn(`Failed to fetch current page data for ID ${id}, proceeding with empty current tags/related`);

    const tagsDiff = computeDiff(currentTags, desiredTags);
    const relatedDiff = computeDiff(currentRelated, desiredRelated);

    const payload = {
        data: serializedData,
        title: req.title,
        tags_to_add: tagsDiff.toAdd,
        tags_to_delete: tagsDiff.toDelete,
        related_to_add: relatedDiff.toAdd,
        related_to_delete: relatedDiff.toDelete,
        is_public: req.is_public ?? false
    };

    const response: any = await api.put(`${PagesRoute}${encodeURIComponent(id)}`, payload);
    if (!response || typeof response.status !== 'number' || (response.status !== 200 && response.status !== 201 && response.status !== 204))
        throw new Error('Failed to update page');
}