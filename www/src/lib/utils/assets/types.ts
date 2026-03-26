export type AssetCategoryId = number;
export type AssetModelId = number;
export type AssetStatusId = number;
export type AssetId = number;

export type SortOrder = 'asc' | 'desc';

export type AssetsFilters = {
    search: string;
    page: number;
    page_size: number;
    sort_order: SortOrder;
    model_id: number | '';
    status: number | '';
    serial_number: string;
    inventory_number: string;
    location: string;
    assigned_to: string;
    ip: string;
    mac: string;
};

export interface IAssetsFiltersStorage {
    get(): AssetsFilters;
    set(filters: AssetsFilters): void;
    clear(): void;
}

export type AssetCategory = {
    id: AssetCategoryId;
    name: string;
    color: string;
    notes?: string;
};

export type AssetModel = {
    id: AssetModelId;
    name: string;
    category: AssetCategory | AssetCategoryId;
};

export type AssetStatus = {
    id: AssetStatusId;
    name: string;
    color: string;
};

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
};

export type PaginatedResponse<T> = {
    items?: T[];
    data?: T[];
    total?: number;
    total_items?: number;
};

export type GetCategoriesParams = {
    page?: number;
    page_size?: number;
    name?: string;
    sort_order?: SortOrder;
};

export type CreateCategoryPayload = {
    name: string;
    color: string;
    notes?: string;
};

export type UpdateCategoryPayload = {
    name?: string;
    color?: string;
    notes?: string;
};

export type GetModelsParams = {
    page?: number;
    page_size?: number;
    name?: string;
    sort_order?: SortOrder;
    category?: number;
};

export type GetAssetsParams = {
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

export type GetStatusesParams = {
    page?: number;
    page_size?: number;
    name?: string;
    sort_order?: SortOrder;
};

export type CreateModelPayload = {
    name: string;
    category: number;
};

export type UpdateModelPayload = {
    name?: string;
    category?: number;
};

export type CreateStatusPayload = {
    name: string;
    color: string;
};

export type UpdateStatusPayload = {
    name?: string;
    color?: string;
};

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
};

export type UpdateAssetPayload = {
    name?: string;
    model_id?: number;
    status?: number;
    description?: string | null;
    serial_number?: string | null;
    inventory_number?: string | null;
    location?: string | null;
    assigned_to?: string | null;
    ip?: string | null;
    mac?: string | null;
};

export type CreateAssetResponse = {
    id: number;
};
