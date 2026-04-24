import type { AssetsFilters, IAssetsFiltersStorage } from '$lib/utils/assets/types';

// Ключ для хранения фильтров активов в `localStorage`.
const FILTERS_KEY = 'assetsFilters';

// Значения фильтров активов по умолчанию.
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

/**
 * Реализация хранилища фильтров активов на основе `localStorage`.
 */
export class LocalStorageAssetsFiltersStorage implements IAssetsFiltersStorage {
    // Текущее состояние фильтров в памяти.
    private filters: AssetsFilters;

    /**
     * Создаёт экземпляр и инициализирует фильтры из `localStorage`.
     */
    constructor() {
        this.filters = this.readFromLocalStorage();
    }

    /**
     * Читает фильтры из `localStorage` и объединяет с дефолтными значениями.
     * При ошибке парсинга очищает повреждённые данные.
     * @returns Полный набор фильтров.
     */
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

    /**
     * Возвращает текущие фильтры.
     * @returns Текущее значение фильтров.
     */
    get(): AssetsFilters {
        return this.filters;
    }

    /**
     * Обновляет фильтры в памяти и сохраняет их в `localStorage`.
     * @param filters Новое значение фильтров.
     */
    set(filters: AssetsFilters): void {
        this.filters = { ...filters };
        localStorage.setItem(FILTERS_KEY, JSON.stringify(this.filters));
    }

    /**
     * Сбрасывает фильтры к значениям по умолчанию и удаляет их из `localStorage`.
     */
    clear(): void {
        this.filters = { ...defaultFilters };
        localStorage.removeItem(FILTERS_KEY);
    }
}

// Текущий экземпляр хранилища фильтров.
let filtersStorage: IAssetsFiltersStorage | null = null;

/**
 * Устанавливает глобальный экземпляр хранилища фильтров.
 * @param storage Экземпляр хранилища.
 */
export function setAssetsFiltersStorage(storage: IAssetsFiltersStorage) {
    filtersStorage = storage;
}

/**
 * Возвращает текущий экземпляр хранилища фильтров.
 * @throws {Error} Если хранилище не инициализировано.
 * @returns Инициализированное хранилище фильтров.
 */
export function getAssetsFiltersStorage(): IAssetsFiltersStorage {
    if (!filtersStorage)
        throw new Error('Assets filters storage is not initialized');

    return filtersStorage;
}

/**
 * Получает текущие фильтры активов из хранилища.
 * @returns Текущее значение фильтров.
 */
export function getAssetsFilters(): AssetsFilters {
    return getAssetsFiltersStorage().get();
}

/**
 * Сохраняет фильтры активов в хранилище.
 * @param filters Новое значение фильтров.
 */
export function setAssetsFilters(filters: AssetsFilters) {
    getAssetsFiltersStorage().set(filters);
}

/**
 * Очищает фильтры активов в хранилище.
 */
export function clearAssetsFilters() {
    getAssetsFiltersStorage().clear();
}
