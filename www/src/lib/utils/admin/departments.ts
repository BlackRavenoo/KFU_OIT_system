import { api } from '$lib/utils/api';
import { fetchConsts } from '$lib/utils/tickets/api/get';

/**
 * Создает новый отдел с заданным именем.
 * Перезапрашивает список констант после создания.
 * @param name Название отдела
 * @returns Promise<void>
 * @throws Error в случае ошибки при создании отдела
 */
export async function createDepartment(name: string): Promise<void> {
    const response = await api.post('/api/v1/departments/', { name });
    
    if (!response.success || (response.status !== 200 && response.status !== 201))
        throw new Error(response.error || 'Ошибка при создании отдела');
    else {
        const data = response.data as { id: number | string; name: string };
        await fetchConsts(true);
    }
}

/**
 * Обновляет название отдела по ID.
 * Перезапрашивает список констант после обновления.
 * @param id ID отдела
 * @param name Новое название отдела
 * @returns Promise<void>
 * @throws Error в случае ошибки при обновлении отдела
 */
export async function updateDepartment(id: string | number, name: string): Promise<void> {
    const response = await api.put(`/api/v1/departments/${id}`, { name });
    
    if (!response.success || (response.status !== 200 && response.status !== 201))
        throw new Error(response.error || 'Ошибка при обновлении отдела');

    await fetchConsts(true);
}

/**
 * Переключает активность (удаляет) отдела.
 * Перезапрашивает список констант после обновления.
 * @param id ID отдела
 * @returns Promise<void>
 * @throws Error в случае ошибки при деактивации отдела
 */
export async function toggleDepartmentActive(id: string | number): Promise<void> {
    const response = await api.post(`/api/v1/departments/${id}/toggle_active`, {});
    
    if (!response.success || (response.status !== 200 && response.status !== 201))
        throw new Error(response.error || 'Ошибка при деактивации отдела');

    await fetchConsts(true);
}