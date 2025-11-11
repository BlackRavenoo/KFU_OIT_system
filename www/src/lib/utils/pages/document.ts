import { api } from '$lib/utils/api';
import { serialize } from '$lib/utils/texteditor/serialize';

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
 * Функция для сохранения страницы на сервере.
 * Сериализует HTML контент, собирает полезную нагрузку и выполняет POST /api/v1/pages/.
 * @param {SavePageRequest} req - параметры сохранения страницы.
 * @returns {Promise<SavePageCreated>} Данные созданной страницы (id и пр. поля ответа).
 * @throws {Error} Если сервер вернул неуспешный статус или произошла ошибка запроса.
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
 * Упрощённая функция сохранения страницы.
 * Возвращает только идентификатор созданной страницы.
 * @param {SavePageRequest} req - параметры сохранения страницы.
 * @returns {Promise<string>} Идентификатор созданной страницы.
 */
export async function savePageAndGetId(req: SavePageRequest): Promise<string> {
    const created = await savePage(req);
    return created.id;
}