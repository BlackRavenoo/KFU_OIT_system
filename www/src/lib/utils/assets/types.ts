// Идентификатор категории актива.
export type AssetCategoryId = number;
// Идентификатор модели актива.
export type AssetModelId = number;
// Идентификатор статуса актива.
export type AssetStatusId = number;

// Идентификатор актива.
export type AssetId = number;
// Направление сортировки.
export type SortOrder = 'asc' | 'desc';

// Фильтры и параметры пагинации для списка активов.
export type AssetsFilters = {
    /** Поисковая строка по общим полям. */
    search: string;
    /** Текущая страница (с 1). */
    page: number;
    page_size: number;
    sort_order: SortOrder;
    /** Фильтр по идентификатору модели; пустая строка означает отсутствие фильтра. */
    model_id: number | '';
    /** Фильтр по идентификатору статуса; пустая строка означает отсутствие фильтра. */
    status: number | '';
    serial_number: string;
    inventory_number: string;
    location: string;
    assigned_to: string;
    ip: string;
    mac: string;
};

// Интерфейс хранилища фильтров активов.
export interface IAssetsFiltersStorage {
    get(): AssetsFilters;
    set(filters: AssetsFilters): void;
    clear(): void;
}

// Категория актива.
export type AssetCategory = {
    id: AssetCategoryId;
    name: string;
    color: string;
    notes?: string;
};

// Модель актива.
export type AssetModel = {
    id: AssetModelId;
    name: string;
    category: AssetCategory | AssetCategoryId;
};

// Статус актива.
export type AssetStatus = {
    id: AssetStatusId;
    name: string;
    color: string;
};

// Актив (инвентарная единица).
export type Asset = {
    id: AssetId;
    model_id: AssetModelId;
    status: AssetStatusId;
    name: string;
    description?: string;
    serial_number?: string;
    inventory_number?: string;
    location?: string;
    assigned_to?: string;
    ip?: string;
    mac?: string;
    photo_url?: string;
    commission_date?: string;
    decommission_date?: string;
};

// Унифицированный формат ответа с пагинацией.
export type PaginatedResponse<T> = {
    /** Массив элементов (вариант поля API №1). */
    items?: T[];
    /** Массив элементов (вариант поля API №2). */
    data?: T[];
    /** Общее число элементов (вариант поля API №1). */
    total?: number;
    /** Общее число элементов (вариант поля API №2). */
    total_items?: number;
};

// Параметры запроса списка категорий.
export type GetCategoriesParams = {
    /** Номер страницы (с 1). */
    page?: number;
    page_size?: number;
    name?: string;
    sort_order?: SortOrder;
};

// Тело запроса на создание категории.
export type CreateCategoryPayload = {
    name: string;
    color: string;
    notes?: string;
};

// Тело запроса на обновление категории.
export type UpdateCategoryPayload = {
    name?: string;
    color?: string;
    notes?: string;
};

// Параметры запроса списка моделей.
export type GetModelsParams = {
    page?: number;
    page_size?: number;
    name?: string;
    sort_order?: SortOrder;
    category?: number;
};

// Параметры запроса списка активов.
export type GetAssetsParams = {
    /** Номер страницы (с 1). */
    page?: number;
    page_size?: number;
    sort_order?: SortOrder;
    model_id?: number;
    status?: number;
    name?: string;
    serial_number?: string;
    inventory_number?: string;
    location?: string;
    assigned_to?: string;
    ip?: string;
    mac?: string;
};

// Параметры запроса списка статусов.
export type GetStatusesParams = {
    /** Номер страницы (с 1). */
    page?: number;
    page_size?: number;
    name?: string;
    sort_order?: SortOrder;
};

// Тело запроса на создание модели.
export type CreateModelPayload = {
    name: string;
    category: number;
};

// Тело запроса на обновление модели.
export type UpdateModelPayload = {
    name?: string;
    category?: number;
};

// Тело запроса на создание статуса.
export type CreateStatusPayload = {
    name: string;
    color: string;
};

// Тело запроса на обновление статуса.
export type UpdateStatusPayload = {
    name?: string;
    color?: string;
};

// Тело запроса на создание актива.
export type CreateAssetPayload = {
    name: string;
    model_id: number;
    status: number;
    photo?: File;
    description?: string;
    serial_number?: string;
    inventory_number?: string;
    location?: string;
    assigned_to?: string;
    ip?: string;
    mac?: string;
    commission_date?: string;
    decommission_date?: string;
};

// Тело запроса на обновление актива.
export type UpdateAssetPayload = {
    name?: string;
    model_id?: number;
    status?: number;
    photo?: File;
    description?: string | null;
    serial_number?: string | null;
    inventory_number?: string | null;
    location?: string | null;
    assigned_to?: string | null;
    ip?: string | null;
    mac?: string | null;
    commission_date?: string | null;
    decommission_date?: string | null;
    remove_photo?: boolean;
};

// Ответ API при успешном создании актива.
export type CreateAssetResponse = {
    id: number;
};
