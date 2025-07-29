import { getAuthTokens } from '$lib/utils/auth/tokens/tokens';
import { toRfc3339, buildQuery } from '$lib/utils/tickets/support';
import { getTicketsFilters } from '$lib/utils/tickets/stores';
import { orderByMap } from '$lib/utils/tickets/types';
import { TICKETS_API_ENDPOINTS } from './endpoints';

/**
 * Получение списка тикетов с учётом фильтров.
 * Использует параметры из хранилища фильтров.
 * Возвращает массив тикетов и максимальное количество страниц.
 */
export async function fetchTickets() {
    const filters = getTicketsFilters();
    const page = (filters as any).page || 1;
    const page_size = filters.page_size;

    const params: Record<string, any> = {
        page,
        page_size,
        order_by: orderByMap[filters.selectedSort] || 'id',
        sort_order: filters.sortOrder,
    };

    if (filters.selectedStatus !== 'all')
        params.statuses = [filters.selectedStatus];

    if (filters.plannedFrom) params.planned_from = toRfc3339(filters.plannedFrom);
    if (filters.plannedTo) params.planned_to = toRfc3339(filters.plannedTo, true);

    if (filters.selectedBuildings.length > 0)
        params.buildings = filters.selectedBuildings;

    if (filters.search) params.search = filters.search;

    const query = buildQuery(params);

    const res = await fetch(`${TICKETS_API_ENDPOINTS.read}?${query}`, {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${getAuthTokens()?.accessToken}`
        }
    });

    if (res.status === 404)
        return { tickets: [], max_page: 1 };

    if (!res.ok) throw new Error('Ошибка загрузки тикетов');
    const data = await res.json();
    return {
        tickets: data.items ?? [],
        max_page: data.max_page ?? 1
    };
}

/**
 * Получение констант для фильтров.
 */
export async function fetchConsts() {
    const res = await fetch(TICKETS_API_ENDPOINTS.consts, { credentials: 'include' });
    if (!res.ok) throw new Error('Ошибка загрузки контактов');
    return await res.json();
}