import type { ITicketsFiltersStorage, TicketsFilters } from '$lib/utils/tickets/types';

const FILTERS_KEY = 'ticketsFilters';

/**
 * Дефолтные значения фильтров для тикетов. 
 * Эти значения будут использоваться при инициализации хранилища и при очистке фильтров.
 */
const defaultFilters: TicketsFilters = {
    search: '',
    viewMode: 'cards',
    sortOrder: 'asc',
    selectedStatus: [],
    selectedBuildings: [],
    plannedFrom: '',
    plannedTo: '',
    page_size: 10,
    selectedSort: 0,
    department: 0,
    page: 1
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

/**
 * Функция для установки хранилища фильтров. 
 * @param {ITicketsFiltersStorage} storage - экземпляр хранилища фильтров
 */
export function setTicketsFiltersStorage(storage: ITicketsFiltersStorage) {
    filtersStorage = storage;
}

/**
 * Функция для получения текущего хранилища фильтров.
 * @throws {Error} если хранилище фильтров не инициализировано
 * @returns {ITicketsFiltersStorage} текущий экземпляр хранилища фильтров
 */
export function getTicketsFiltersStorage(): ITicketsFiltersStorage {
    if (!filtersStorage)
        throw new Error('Tickets filters storage is not initialized');
    return filtersStorage;
}

/**
 * Функция для получения текущих фильтров тикетов из хранилища.
 * @returns {TicketsFilters} текущие фильтры тикетов
 */
export function getTicketsFilters(): TicketsFilters {
    return getTicketsFiltersStorage().get();
}

/**
 * Функция для установки новых фильтров тикетов в хранилище.
 * @param {TicketsFilters} filters - новые фильтры тикетов
 */
export function setTicketsFilters(filters: TicketsFilters) {
    getTicketsFiltersStorage().set(filters);
}

/**
 * Функция для очистки фильтров тикетов, возвращая их к дефолтным значениям.
 */
export function clearTicketsFilters() {
    getTicketsFiltersStorage().clear();
}