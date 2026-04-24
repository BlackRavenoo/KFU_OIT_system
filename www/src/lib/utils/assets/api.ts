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

// Базовый URL для API-операций с активами, категориями и моделями.
const BASE = '/api/v1/assets';

/**
 * Получает список категорий активов.
 * @param params Параметры пагинации, сортировки и фильтрации.
 * @returns Запрос, возвращающий пагинированный список категорий.
 */
export function getCategories(params?: GetCategoriesParams) {
    return api.get<PaginatedResponse<AssetCategory>>(`${BASE}/categories`, params ?? {});
}

/**
 * Создаёт новую категорию актива.
 * @param payload Данные для создания категории.
 * @returns Запрос, возвращающий идентификатор созданной категории.
 */
export function createCategory(payload: CreateCategoryPayload) {
    return api.post<{ id: number }>(`${BASE}/categories`, {
        ...payload,
        color: toApiColor(payload.color),
    });
}

/**
 * Обновляет существующую категорию.
 * @param categoryId Идентификатор обновляемой категории.
 * @param payload Поля для обновления категории.
 * @returns Запрос на обновление категории.
 */
export function updateCategory(categoryId: number, payload: UpdateCategoryPayload) {
    const preparedPayload: UpdateCategoryPayload = { ...payload };
    if (preparedPayload.color) preparedPayload.color = toApiColor(preparedPayload.color);
    else preparedPayload.color = toApiColor('');
    return api.put(`${BASE}/categories/${categoryId}`, preparedPayload);
}

/**
 * Удаляет категорию по идентификатору.
 * @param categoryId Идентификатор удаляемой категории.
 * @returns Запрос на удаление категории.
 */
export function deleteCategory(categoryId: number) {
    return api.delete(`${BASE}/categories/${categoryId}`);
}

/**
 * Получает список моделей активов.
 * @param params Параметры пагинации, сортировки и фильтрации.
 * @returns Запрос, возвращающий пагинированный список моделей.
 */
export function getModels(params?: GetModelsParams) {
    return api.get<PaginatedResponse<AssetModel>>(`${BASE}/models`, params ?? {});
}

/**
 * Получает список активов.
 * @param params Параметры пагинации, сортировки и фильтрации.
 * @returns Запрос, возвращающий пагинированный список активов.
 */
export function getAssets(params?: GetAssetsParams) {
    return api.get<PaginatedResponse<Asset>>(`${BASE}`, params ?? {});
}

/**
 * Создаёт новую модель актива.
 * @param payload Данные для создания модели.
 * @returns Запрос, возвращающий идентификатор созданной модели.
 */
export function createModel(payload: CreateModelPayload) {
    return api.post<{ id: number }>(`${BASE}/models`, payload);
}

/**
 * Обновляет существующую модель актива.
 * @param modelId Идентификатор обновляемой модели.
 * @param payload Поля для обновления модели.
 * @returns Запрос на обновление модели.
 */
export function updateModel(modelId: number, payload: UpdateModelPayload) {
    return api.put(`${BASE}/models/${modelId}`, payload);
}

/**
 * Удаляет модель актива по идентификатору.
 * @param modelId Идентификатор удаляемой модели.
 * @returns Запрос на удаление модели.
 */
export function deleteModel(modelId: number) {
    return api.delete(`${BASE}/models/${modelId}`);
}

/**
 * Преобразует данные создания актива в `FormData` для multipart-запроса.
 * @param payload Полезная нагрузка создания актива.
 * @returns Подготовленный объект `FormData`.
 */
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

/**
 * Преобразует данные обновления актива в `FormData` для multipart-запроса.
 * @param payload Полезная нагрузка обновления актива.
 * @returns Подготовленный объект `FormData`.
 */
function toAssetUpdateFormData(payload: UpdateAssetPayload): FormData {
    const { photo, ...fields } = payload;

    const formData = new FormData();
    formData.append(
        'fields',
        new Blob([JSON.stringify(fields)], { type: 'application/json' })
    );

    if (photo) formData.append('photo', photo, photo.name);

    return formData;
}

/**
 * Создаёт новый актив.
 * @param payload Данные для создания актива.
 * @returns Запрос, возвращающий идентификатор созданного актива.
 */
export function createAsset(payload: CreateAssetPayload) {
    return api.post<CreateAssetResponse>(`${BASE}`, toAssetCreateFormData(payload));
}

/**
 * Обновляет существующий актив.
 * @param assetId Идентификатор обновляемого актива.
 * @param payload Поля для обновления актива.
 * @returns Запрос на обновление актива.
 */
export function updateAsset(assetId: number, payload: UpdateAssetPayload) {
    return api.put(`${BASE}/${assetId}`, toAssetUpdateFormData(payload));
}

/**
 * Удаляет актив по идентификатору.
 * @param assetId Идентификатор удаляемого актива.
 * @returns Запрос на удаление актива.
 */
export function deleteAsset(assetId: number) {
    return api.delete(`${BASE}/${assetId}`);
}