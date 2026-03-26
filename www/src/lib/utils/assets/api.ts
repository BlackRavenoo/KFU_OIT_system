import { api } from '$lib/utils/api';
import { toApiColor } from '$lib/utils/assets/helpers';
import type {
    Asset,
    AssetCategory,
    AssetModel,
    CreateAssetPayload,
    CreateAssetResponse,
    CreateCategoryPayload,
    GetAssetsParams,
    CreateModelPayload,
    GetCategoriesParams,
    GetModelsParams,
    PaginatedResponse,
    UpdateAssetPayload,
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
    else preparedPayload.color = toApiColor('');
    return api.put(`${BASE}/categories/${categoryId}`, preparedPayload);
}

export function deleteCategory(categoryId: number) {
    return api.delete(`${BASE}/categories/${categoryId}`);
}

export function getModels(params?: GetModelsParams) {
    return api.get<PaginatedResponse<AssetModel>>(`${BASE}/models`, params ?? {});
}

export function getAssets(params?: GetAssetsParams) {
    return api.get<PaginatedResponse<Asset>>(`${BASE}`, params ?? {});
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

function toAssetCreateFormData(payload: CreateAssetPayload): FormData {
    const { photo, ...fields } = payload;

    const formData = new FormData();
    formData.append(
        'fields',
        new Blob([JSON.stringify(fields)], { type: 'application/json' })
    );

    if (photo) formData.append('photo', photo, photo.name);

    return formData;
}

export function createAsset(payload: CreateAssetPayload) {
    return api.post<CreateAssetResponse>(`${BASE}`, toAssetCreateFormData(payload));
}

export function updateAsset(assetId: number, payload: UpdateAssetPayload) {
    return api.put(`${BASE}/${assetId}`, payload);
}

export function deleteAsset(assetId: number) {
    return api.delete(`${BASE}/${assetId}`);
}