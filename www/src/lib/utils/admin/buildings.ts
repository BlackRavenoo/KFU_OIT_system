import { api } from '$lib/utils/api';
import { fetchConsts } from '$lib/utils/tickets/api/get';

/**
 * Создает новое здание в константах.
 * Перезапрашивает список констант после создания.
 * @param {string} code - Код здания
 * @param {string} name - Название здания
 * @throws {Error} Если запрос не удался или вернул статус, отличный от 200 или 201
 */
export async function createBuilding(code: string, name: string): Promise<void> {
    const response = await api.post('/api/v1/buildings/', { code, name });

    if (!response.success || (response.status !== 200 && response.status !== 201))
        throw new Error(response.error || 'Ошибка при создании здания');
    await fetchConsts(true);
}

/**
 * Обновляет здание в константах.
 * Перезапрашивает список констант после обновления.
 * @param {string | number} id - ID здания
 * @param {string} code - Код здания
 * @param {string} name - Название здания
 * @throws {Error} Если запрос не удался или вернул статус, отличный от 200 или 201
 */
export async function updateBuilding(id: string | number, code: string, name: string): Promise<void> {
    const response = await api.put(`/api/v1/buildings/${id}`, { code, name });

    if (!response.success || (response.status !== 200 && response.status !== 201))
        throw new Error(response.error || 'Ошибка при обновлении здания');
    await fetchConsts(true);
}

/**
 * Переключает активность (удаляет) здания.
 * Перезапрашивает список констант после обновления.
 * @param {string | number} id - ID здания
 * @param {boolean} status - Новый статус активности здания
 * @throws {Error} Если запрос не удался или вернул статус, отличный от 200 или 201
 */
export async function toggleBuildingActive(id: string | number, status: boolean): Promise<void> {
    const response = await api.post(`/api/v1/buildings/${id}/set_active`, {"is_active": status});

    if (!response.success || (response.status !== 200 && response.status !== 201))
        throw new Error(response.error || 'Ошибка при деактивации здания');
    await fetchConsts(true);
}