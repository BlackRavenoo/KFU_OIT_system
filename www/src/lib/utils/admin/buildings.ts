import { api } from '$lib/utils/api';
import { fetchConsts } from '$lib/utils/tickets/api/get';

/**
 * Создает новое здание в константах.
 * Перезапрашивает список констант после создания.
 * @param code Код здания
 * @param name Название здания
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
 * @param id ID здания
 * @param code Код здания
 * @param name Название здания
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
 * @param id ID здания
 */
export async function toggleBuildingActive(id: string | number): Promise<void> {
    const response = await api.post(`/api/v1/buildings/${id}/toggle_active`, {});

    if (!response.success || (response.status !== 200 && response.status !== 201))
        throw new Error(response.error || 'Ошибка при деактивации здания');
    await fetchConsts(true);
}