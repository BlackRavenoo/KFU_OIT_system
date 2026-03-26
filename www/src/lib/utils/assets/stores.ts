import type { AssetsFilters, IAssetsFiltersStorage } from '$lib/utils/assets/types';

const FILTERS_KEY = 'assetsFilters';

const defaultFilters: AssetsFilters = {
    search: '',
    page: 1,
    page_size: 10,
    sort_order: 'asc',
    model_id: '',
    status: '',
    serial_number: '',
    inventory_number: '',
    location: '',
    assigned_to: '',
    ip: '',
    mac: '',
};

export class LocalStorageAssetsFiltersStorage implements IAssetsFiltersStorage {
    private filters: AssetsFilters;

    constructor() {
        this.filters = this.readFromLocalStorage();
    }

    private readFromLocalStorage(): AssetsFilters {
        try {
            const stored = localStorage.getItem(FILTERS_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as Partial<AssetsFilters>;
                return { ...defaultFilters, ...parsed };
            }
        } catch {
            localStorage.removeItem(FILTERS_KEY);
        }

        return { ...defaultFilters };
    }

    get(): AssetsFilters {
        return this.filters;
    }

    set(filters: AssetsFilters): void {
        this.filters = { ...filters };
        localStorage.setItem(FILTERS_KEY, JSON.stringify(this.filters));
    }

    clear(): void {
        this.filters = { ...defaultFilters };
        localStorage.removeItem(FILTERS_KEY);
    }
}

let filtersStorage: IAssetsFiltersStorage | null = null;

export function setAssetsFiltersStorage(storage: IAssetsFiltersStorage) {
    filtersStorage = storage;
}

export function getAssetsFiltersStorage(): IAssetsFiltersStorage {
    if (!filtersStorage)
        throw new Error('Assets filters storage is not initialized');

    return filtersStorage;
}

export function getAssetsFilters(): AssetsFilters {
    return getAssetsFiltersStorage().get();
}

export function setAssetsFilters(filters: AssetsFilters) {
    getAssetsFiltersStorage().set(filters);
}

export function clearAssetsFilters() {
    getAssetsFiltersStorage().clear();
}
