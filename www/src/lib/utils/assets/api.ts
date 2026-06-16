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
 * @param {GetCategoriesParams} [params] - Параметры пагинации, сортировки и фильтрации.
 * @returns {Promise<PaginatedResponse<AssetCategory>>} Запрос, возвращающий пагинированный список категорий.
 */
export function getCategories(params?: GetCategoriesParams) {
    return api.get<PaginatedResponse<AssetCategory>>(`${BASE}/categories`, params ?? {});
}

/**
 * Создаёт новую категорию актива.
 * @param {CreateCategoryPayload} payload - Данные для создания категории.
 * @returns {Promise<{ id: number }>} Запрос, возвращающий идентификатор созданной категории.
 */
export function createCategory(payload: CreateCategoryPayload) {
    return api.post<{ id: number }>(`${BASE}/categories`, {
        ...payload,
        color: toApiColor(payload.color),
    });
}

/**
 * Обновляет существующую категорию.
 * @param {number} categoryId - Идентификатор обновляемой категории.
 * @param {UpdateCategoryPayload} payload - Поля для обновления категории.
 * @returns {Promise<void>} Запрос на обновление категории.
 */
export function updateCategory(categoryId: number, payload: UpdateCategoryPayload) {
    const preparedPayload: UpdateCategoryPayload = { ...payload };
    if (preparedPayload.color) preparedPayload.color = toApiColor(preparedPayload.color);
    else preparedPayload.color = toApiColor('');
    return api.put(`${BASE}/categories/${categoryId}`, preparedPayload);
}

/**
 * Удаляет категорию по идентификатору.
 * @param {number} categoryId - Идентификатор удаляемой категории.
 * @returns {Promise<void>} Запрос на удаление категории.
 */
export function deleteCategory(categoryId: number) {
    return api.delete(`${BASE}/categories/${categoryId}`);
}

/**
 * Получает список моделей активов.
 * @param {GetModelsParams} [params] - Параметры пагинации, сортировки и фильтрации.
 * @returns {Promise<PaginatedResponse<AssetModel>>} Запрос, возвращающий пагинированный список моделей.
 */
export function getModels(params?: GetModelsParams) {
    return api.get<PaginatedResponse<AssetModel>>(`${BASE}/models`, params ?? {});
}

/**
 * Получает список активов.
 * @param {GetAssetsParams} [params] - Параметры пагинации, сортировки и фильтрации.
 * @returns {Promise<PaginatedResponse<Asset>>} Запрос, возвращающий пагинированный список активов.
 */
export function getAssets(params?: GetAssetsParams) {
    return api.get<PaginatedResponse<Asset>>(`${BASE}`, params ?? {});
}

/**
 * Создаёт новую модель актива.
 * @param {CreateModelPayload} payload - Данные для создания модели.
 * @returns {Promise<{ id: number }>} Запрос, возвращающий идентификатор созданной модели.
 */
export function createModel(payload: CreateModelPayload) {
    return api.post<{ id: number }>(`${BASE}/models`, payload);
}

/**
 * Обновляет существующую модель актива.
 * @param {number} modelId - Идентификатор обновляемой модели.
 * @param {UpdateModelPayload} payload - Поля для обновления модели.
 * @returns {Promise<void>} Запрос на обновление модели.
 */
export function updateModel(modelId: number, payload: UpdateModelPayload) {
    return api.put(`${BASE}/models/${modelId}`, payload);
}

/**
 * Удаляет модель актива по идентификатору.
 * @param {number} modelId - Идентификатор удаляемой модели.
 * @returns {Promise<void>} Запрос на удаление модели.
 */
export function deleteModel(modelId: number) {
    return api.delete(`${BASE}/models/${modelId}`);
}

/**
 * Преобразует данные создания актива в `FormData` для multipart-запроса.
 * @param {CreateAssetPayload} payload - Полезная нагрузка создания актива.
 * @returns {FormData} Подготовленный объект `FormData`.
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
 * @param {UpdateAssetPayload} payload - Полезная нагрузка обновления актива.
 * @returns {FormData} Подготовленный объект `FormData`.
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
 * @param {CreateAssetPayload} payload - Данные для создания актива.
 * @returns {Promise<CreateAssetResponse>} Запрос, возвращающий идентификатор созданного актива.
 */
export function createAsset(payload: CreateAssetPayload) {
    return api.post<CreateAssetResponse>(`${BASE}`, toAssetCreateFormData(payload));
}

/**
 * Обновляет существующий актив.
 * @param {number} assetId - Идентификатор обновляемого актива.
 * @param {UpdateAssetPayload} payload - Поля для обновления актива.
 * @returns {Promise<void>} Запрос на обновление актива.
 */
export function updateAsset(assetId: number, payload: UpdateAssetPayload) {
    return api.put(`${BASE}/${assetId}`, toAssetUpdateFormData(payload));
}

/**
 * Удаляет актив по идентификатору.
 * @param {number} assetId - Идентификатор удаляемого актива.
 * @returns {Promise<void>} Запрос на удаление актива.
 */
export function deleteAsset(assetId: number) {
    return api.delete(`${BASE}/${assetId}`);
}