import { api } from '$lib/utils/api';
import { serialize } from '$lib/utils/texteditor/serialize';
import { deserialize } from '$lib/utils/texteditor/serialize';

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
 * @param isPublic Флаг публичности страницы
 * @param key Ключ/путь контента как от сервера
 * @returns HTML-строка для вставки в документ
 * @throws Error если формат ответа некорректный или сервер вернул ошибку
 */
export async function fetchPageContentByKey(isPublic: boolean, key: string): Promise<string> {
    const prefix = isPublic ? 'public' : 'private';
    const cleanedKey = (key ?? '').replace(/^\/?pages\//i, '');

    const resp = await api.get<unknown>(`/api/v1/page/${prefix}/${cleanedKey}`);

    const ok = resp.status === 200 || resp.status === 201 || resp.status === 204 || resp.status === 304;
    if (!ok) throw new Error(resp.error || `HTTP ${resp.status}`);

    let data: unknown = resp.data;

    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch {
            console.warn('Response data is not valid JSON, using raw string');
        }
    }

    if (Array.isArray(data)) return deserialize(data as any);
    if (typeof data === 'string') return data;

    throw new Error('Некорректный формат контента');
}