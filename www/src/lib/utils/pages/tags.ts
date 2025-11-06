import { api } from '$lib/utils/api';
import { get } from 'svelte/store';
import { currentUser } from '$lib/utils/auth/storage/initial';
import { UserRole } from '$lib/utils/auth/types';

export interface ServerTagDto {
    id: number;
    name: string;
}

const TagsRoute = '/api/v1/tags/';

/**
 * Функция для получения списка тегов с сервера по поисковому запросу.
 * @param {string} query - поисковый запрос для тегов.
 * @returns {Promise<ServerTagDto[]>} Массив тегов { id, name }, соответствующих запросу.
 */
export async function fetchTags(query: string): Promise<ServerTagDto[]> {
    const q = (query ?? '').trim();
    if (!q) return [];
    const res: any = await api.get(`${TagsRoute}?q=${encodeURIComponent(q)}`);
    const data: unknown = res?.data;

    if (!Array.isArray(data)) return [];
    return (data as any[])
        .map((t) => ({
            id: Number(t?.id ?? -1),
            name: String(t?.name ?? '')
        }))
        .filter((t) => t.id > -1 && t.name.length > 0);
}

/**
 * Функция для создания нового тега на сервере при наличии прав.
 * @param {string} name - имя тега для создания.
 * @returns {Promise<ServerTagDto>} Созданный тег { id, name }.
 * @throws {Error} Если имя пустое, роль недостаточна или сервер вернул ошибку.
 */
export async function createTagIfAllowed(name: string): Promise<ServerTagDto> {
    const trimmed = (name ?? '').trim();
    if (!trimmed) throw new Error('Empty tag name');

    const user = get(currentUser) as { role?: UserRole } | null;
    const role = user?.role;
    if (role !== UserRole.Moderator && role !== UserRole.Administrator) {
        throw new Error('Forbidden: insufficient role');
    }

    const res: any = await api.post(TagsRoute, { name: trimmed, synonyms: [] });
    if (!res || typeof res.status !== 'number' || res.status < 200 || res.status >= 300) {
        throw new Error('Failed to create tag');
    }

    const created: any = res?.data;
    const id = Number(created?.id ?? -1);
    const createdName = String(created?.name ?? '');

    if (id > -1 && createdName) return { id, name: createdName };
    throw new Error('Invalid server response: tag id or name missing');
}

/**
 * Функция для добавления тега из подсказок.
 * Добавляет тег только если он присутствует в списке подсказок и ещё не выбран (по id).
 * @param {ServerTagDto[]} selected - текущий список выбранных тегов.
 * @param {ServerTagDto} tag - тег, который нужно добавить.
 * @param {ServerTagDto[]} suggestions - список подсказок (существующих тегов).
 * @returns {ServerTagDto[]} Новый массив выбранных тегов (immutable).
 */
export function addTagFromSuggestion(
    selected: ServerTagDto[],
    tag: ServerTagDto,
    suggestions: ServerTagDto[]
): ServerTagDto[] {
    if (!tag?.id || !tag?.name) return selected;
    if (!Array.isArray(suggestions) || !suggestions.some((s) => s.id === tag.id)) return selected;
    if (selected.some((s) => s.id === tag.id)) return selected;
    return [...selected, tag];
}

/**
 * Функция для удаления тега из списка выбранных.
 * @param {ServerTagDto[]} selected - текущий список выбранных тегов.
 * @param {string} id - идентификатор тега, который необходимо удалить.
 * @returns {ServerTagDto[]} Новый массив выбранных тегов без удалённого (immutable).
 */
export function removeTag(selected: ServerTagDto[], id: number): ServerTagDto[] {
    if (!id) return selected;
    return selected.filter((x) => x.id !== id);
}