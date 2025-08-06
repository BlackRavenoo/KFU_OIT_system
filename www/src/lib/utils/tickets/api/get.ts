import { get } from 'svelte/store';

import { getAuthTokens } from '$lib/utils/auth/tokens/tokens';
import { toRfc3339, buildQuery } from '$lib/utils/tickets/support';
import { getTicketsFilters } from '$lib/utils/tickets/stores';
import { orderByMap } from '$lib/utils/tickets/types';
import { TICKETS_API_ENDPOINTS } from './endpoints';
import { order, buildings } from '$lib/utils/setup/stores';
import type { Building, OrderBy, Ticket } from '$lib/utils/tickets/types';

/**
 * Получение списка тикетов с учётом фильтров.
 * Использует параметры из хранилища фильтров.
 * Возвращает массив тикетов и максимальное количество страниц.
 * @param search Строка для поиска по тикетам (необязательный параметр).
 */
export async function fetchTickets(search: string = '') {
    const filters = getTicketsFilters();
    const page = (filters as any).page || 1;
    const page_size = filters.page_size;

    const params: Record<string, any> = {
        page,
        page_size,
        order_by: orderByMap[filters.selectedSort] || 'id',
        sort_order: filters.sortOrder,
        // search
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
 * Получение тикета по ID.
 * Использует API для получения данных тикета.
 * @returns Promise<Ticket>
 */
export async function getById(id: string): Promise<Ticket> {
    const result = fetch(`${TICKETS_API_ENDPOINTS.read}${id}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthTokens()?.accessToken}`
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('Ошибка получения заявки');
        return response.json();
    })
    .catch(error => {
        return {
            id: 0,
            title: 'Ошибка',
            description: error.message,
            author: 'system',
            author_contacts: '',
            status: 'cancelled',
            priority: 'critical',
            planned_at: null,
            assigned_to: null,
            created_at: new Date().toISOString(),
            attachments: [],
            building: { id: 0, code: '', name: '' },
            cabinet: ''
        } as Ticket;
    });
    return result;
}

/**
 * Получение констант для фильтров.
 * Если константы уже загружены, возвращает их из хранилища.
 * @returns {Promise<{ buildings: Building[], order: OrderBy[] }>}
 */
export async function fetchConsts(): Promise<{ buildings: Building[], order: OrderBy[] }> {
    if (get(order).length === 0 || get(buildings).length === 0) {
        const res = await fetch(TICKETS_API_ENDPOINTS.consts, { credentials: 'include' });
        if (!res.ok) throw new Error('Ошибка загрузки контактов');
        const data = await res.json();
        buildings.set(Array.isArray(data.buildings) ? data.buildings : []);
        order.set(Array.isArray(data.order_by) ? data.order_by : []);
        return {
            buildings: Array.isArray(data.buildings) ? data.buildings : [],
            order: Array.isArray(data.order) ? data.order : []
        };
    } else {
        return {
            buildings: get(buildings),
            order: get(order)
        };
    }
}

/**
 * Загрузка изображений по ключам вложений.
 * Использует API для получения изображений по ключам.
 * @returns {Promise<string[]>} Массив sизображений.
 */
export async function fetchImages(attachments: string[]): Promise<string[]> {
    let images: string[] = [];
    for (const key of attachments) {
        try {
            const res = await fetch(`${TICKETS_API_ENDPOINTS.attachments}/${key.split('/').pop()}`);
            if (!res.ok) continue;
            const blob = await res.blob();
            images = [...images, URL.createObjectURL(blob)];
        } catch { }
    }
    return images;
}