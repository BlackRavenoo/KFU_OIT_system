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
 * SOLID-реализация хранилища фильтров через localStorage и внутреннее состояние.
 */
export class LocalStorageTicketsFiltersStorage implements ITicketsFiltersStorage {
    private filters: TicketsFilters;

    constructor() {
        this.filters = this.readFromLocalStorage();
    }

    private readFromLocalStorage(): TicketsFilters {
        try {
            const stored = localStorage.getItem(FILTERS_KEY);
            if (stored)
                return { ...defaultFilters, ...JSON.parse(stored) };
        } catch {
            localStorage.removeItem(FILTERS_KEY);
        }
        return { ...defaultFilters };
    }

    get(): TicketsFilters {
        return this.filters;
    }

    set(filters: TicketsFilters): void {
        this.filters = { ...filters };
        localStorage.setItem(FILTERS_KEY, JSON.stringify(this.filters));
    }

    clear(): void {
        this.filters = { ...defaultFilters };
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