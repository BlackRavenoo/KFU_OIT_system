import type { ITicketsFiltersStorage, TicketsFilters } from '$lib/utils/tickets/types';

const FILTERS_KEY = 'ticketsFilters';

const defaultFilters: TicketsFilters = {
    search: '',
    viewMode: 'cards',
    sortOrder: 'asc',
    selectedStatus: 'all',
    selectedBuildings: [],
    plannedFrom: '',
    plannedTo: '',
    page_size: 10,
    selectedSort: 0
};

/**
 * SOLID-реализация хранилища фильтров через localStorage.
 */
export class LocalStorageTicketsFiltersStorage implements ITicketsFiltersStorage {
    get(): TicketsFilters {
        try {
            const stored = localStorage.getItem(FILTERS_KEY);
            if (stored)
                return { ...defaultFilters, ...JSON.parse(stored) };
        } catch {
            localStorage.removeItem(FILTERS_KEY);
        }
        return { ...defaultFilters };
    }

    set(filters: TicketsFilters): void {
        localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
    }

    clear(): void {
        localStorage.removeItem(FILTERS_KEY);
    }
}

let filtersStorage: ITicketsFiltersStorage | null = null;

export function setTicketsFiltersStorage(storage: ITicketsFiltersStorage) {
    filtersStorage = storage;
}

export function getTicketsFiltersStorage(): ITicketsFiltersStorage {
    if (!filtersStorage)
        throw new Error('Tickets filters storage is not initialized');
    return filtersStorage;
}

export function getTicketsFilters(): TicketsFilters {
    return getTicketsFiltersStorage().get();
}

export function setTicketsFilters(filters: TicketsFilters) {
    getTicketsFiltersStorage().set(filters);
}

export function clearTicketsFilters() {
    getTicketsFiltersStorage().clear();
}