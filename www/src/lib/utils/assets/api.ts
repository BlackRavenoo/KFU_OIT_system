import { api } from '$lib/utils/api';
import { toApiColor } from '$lib/utils/assets/helpers';
import type {
    AssetCategory,
    AssetModel,
    AssetStatus,
    CreateCategoryPayload,
    CreateModelPayload,
    GetCategoriesParams,
    GetModelsParams,
    GetStatusesParams,
    PaginatedResponse,
    UpdateCategoryPayload,
    UpdateModelPayload,
} from '$lib/utils/assets/types';

const BASE = '/api/v1/assets';

export function getCategories(params?: GetCategoriesParams) {
    return api.get<PaginatedResponse<AssetCategory>>(`${BASE}/categories`, params ?? {});
}

export function createCategory(payload: CreateCategoryPayload) {
    return api.post<{ id: number }>(`${BASE}/categories`, {
        ...payload,
        color: toApiColor(payload.color),
    });
}

export function updateCategory(categoryId: number, payload: UpdateCategoryPayload) {
    const preparedPayload: UpdateCategoryPayload = { ...payload };

    if (preparedPayload.color) preparedPayload.color = toApiColor(preparedPayload.color);

    return api.put(`${BASE}/categories/${categoryId}`, preparedPayload);
}

export function deleteCategory(categoryId: number) {
    return api.delete(`${BASE}/categories/${categoryId}`);
}

export function getModels(params?: GetModelsParams) {
    return api.get<PaginatedResponse<AssetModel>>(`${BASE}/models`, params ?? {});
}

export function getStatuses(params?: GetStatusesParams) {
    return api.get<PaginatedResponse<AssetStatus>>(`${BASE}/statuses`, params ?? {});
}

export function createModel(payload: CreateModelPayload) {
    return api.post<{ id: number }>(`${BASE}/models`, payload);
}

export function updateModel(modelId: number, payload: UpdateModelPayload) {
    return api.put(`${BASE}/models/${modelId}`, payload);
}

export function deleteModel(modelId: number) {
    return api.delete(`${BASE}/models/${modelId}`);
}
