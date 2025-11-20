import { api } from '$lib/utils/api';
import type { Department } from '$lib/utils/tickets/types';

export async function createDepartment(name: string): Promise<Department> {
    const response = await api.post('/api/v1/departments/', { name });
    
    if (!response.success || (response.status !== 200 && response.status !== 201))
        throw new Error(response.error || 'Ошибка при создании отдела');
    else {
        const data = response.data as { id: number | string; name: string };
        return {
            id: Number(data.id),
            name: data.name
        };
    }
}

export async function updateDepartment(id: string | number, name: string): Promise<void> {
    const response = await api.put(`/api/v1/departments/${id}`, { name });
    
    if (!response.success || (response.status !== 200 && response.status !== 201))
        throw new Error(response.error || 'Ошибка при обновлении отдела');
}

export async function toggleDepartmentActive(id: string | number): Promise<void> {
    const response = await api.post(`/api/v1/departments/${id}/toggle_active`, {});
    
    if (!response.success || (response.status !== 200 && response.status !== 201))
        throw new Error(response.error || 'Ошибка при деактивации отдела');
}