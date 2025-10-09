import { get } from 'svelte/store';

import { api } from '$lib/utils/api';
import { toRfc3339, buildQuery } from '$lib/utils/tickets/support';
import { getTicketsFilters } from '$lib/utils/tickets/stores';
import { orderByMap } from '$lib/utils/tickets/types';
import { TICKETS_API_ENDPOINTS } from './endpoints';
import { order, buildings } from '$lib/utils/setup/stores';
import { validatePageSize } from '$lib/utils/validation/validate';
import type { Building, OrderBy, Ticket } from '$lib/utils/tickets/types';

const CACHE_KEY_CONSTS = 'tickets_consts_cache';
const CACHE_TTL_CONSTS = 15 * 60 * 1000;

/**
 * Получение списка тикетов с учётом фильтров.
 * Использует параметры из хранилища фильтров.
 * Возвращает массив тикетов и максимальное количество страниц.
 * @param search Строка для поиска по тикетам (необязательный параметр).
 */
export async function fetchTickets(search: string = '', search_params: Record<string, any> = {}): Promise<{ tickets: Ticket[]; max_page: number }> {
    const filters = getTicketsFilters();
    const page = search_params.page || 1; 
    const page_size = validatePageSize(filters.page_size) ? filters.page_size : 10;
    
    let params: Record<string, any> = {};
    
    if (Object.keys(search_params).length === 0 || Object.keys(search_params).length === 1 && 'page' in search_params) {
        params = {
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
            
        if (search || filters.search) params.search = search || filters.search;
    } else {
        params = {...search_params};
    }

    const query = buildQuery(params);
    const response = await api.get<{ items: Ticket[]; max_page: number }>(
        `${TICKETS_API_ENDPOINTS.read}?${query}`
    );

    if (!response.success) {
        if (response.status === 404)
            return { tickets: [], max_page: 1 };
        throw new Error(response.error || 'Ошибка загрузки тикетов');
    }

    return {
        tickets: response.data?.items ?? [],
        max_page: response.data?.max_page ?? 1
    };
}

/**
 * Получение тикета по ID.
 * Использует API для получения данных тикета.
 * @returns Promise<Ticket>
 */
export async function getById(id: string): Promise<Ticket> {
    const response = await api.get<Ticket>(`${TICKETS_API_ENDPOINTS.read}${id}`);

    if (!response.success)
        throw new Error(response.error || 'Ошибка получения заявки');

    return response.data!;
}

/**
 * Получение констант для фильтров.
 * Если константы уже загружены, возвращает их из хранилища.
 * @returns {Promise<{ buildings: Building[], order: OrderBy[] }>}
 */
export async function fetchConsts(): Promise<{ buildings: Building[], order: OrderBy[] }> {
    try {
        const cacheRaw = localStorage.getItem(CACHE_KEY_CONSTS);
        if (cacheRaw) {
            const cache = JSON.parse(cacheRaw);
            if (Date.now() - cache.timestamp < CACHE_TTL_CONSTS) {
                buildings.set(Array.isArray(cache.data.buildings) ? cache.data.buildings : []);
                order.set(Array.isArray(cache.data.order) ? cache.data.order : []);
                return cache.data;
            }
        }
    } catch {
        console.warn('Не удалось загрузить константы из кеша');
    }

    if (get(order).length === 0 || get(buildings).length === 0) {
        const response = await api.get<{ buildings: Building[]; order_by: OrderBy[] }>(
            TICKETS_API_ENDPOINTS.consts
        );

        if (!response.success)
            throw new Error(response.error || 'Ошибка загрузки констант');

        const data = response.data!;
        const result = {
            buildings: Array.isArray(data.buildings) ? data.buildings : [],
            order: Array.isArray(data.order_by) ? data.order_by : []
        };

        buildings.set(result.buildings);
        order.set(result.order);

        try {
            localStorage.setItem(CACHE_KEY_CONSTS, JSON.stringify({
                timestamp: Date.now(),
                data: result
            }));
        } catch {
            console.warn('Не удалось сохранить константы в кеш');}

        return result;
    } else {
        const result = {
            buildings: get(buildings),
            order: get(order)
        };

        try {
            localStorage.setItem(CACHE_KEY_CONSTS, JSON.stringify({
                timestamp: Date.now(),
                data: result
            }));
        } catch {
            console.warn('Не удалось сохранить константы в кеш');
        }

        return result;
    }
}

/**
 * Загрузка изображений по ключам вложений.
 * Использует API для получения изображений по ключам.
 * @returns {Promise<string[]>} Массив изображений.
 */
export async function fetchImages(attachments: string[]): Promise<string[]> {
    let images: string[] = [];
    for (const key of attachments) {
        try {
            const response = await api.get<Blob>(
                `${TICKETS_API_ENDPOINTS.attachments}/${key.split('/').pop()}`,
                undefined,
                'blob'
            );

            if (!response.success) continue;

            const blob = response.data!;
            images = [...images, URL.createObjectURL(blob)];
        } catch { }
    }
    return images;
}

/**
 * Загрузка активных заявок пользователя
 * @param userId ID пользователя
 * @returns Массив активных заявок
 */
export async function loadActiveUserTickets(userId: string): Promise<any[]> {
    try {
        if (!userId) return [];
        
        const result = await fetchTickets('', {
            assigned_to: userId,
            page: 1,
            page_size: 3,
            order_by: 'id',
            sort_order: 'asc',
            statuses: ['inprogress']
        });
        
        return result.tickets;
    } catch (error) {
        return [];
    }
}