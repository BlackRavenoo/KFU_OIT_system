import type {
    Asset,
    AssetCategory,
    AssetModel,
    AssetStatus,
    PaginatedResponse,
} from '$lib/utils/assets/types';

// Резервный цвет, используемый при отсутствии валидного цвета категории.
const FALLBACK_COLOR = '#6B7280';

/**
 * Приводит цвет к UI-формату.
 * Если строка пустая, возвращает резервный цвет.
 * @param {string} color - Исходное значение цвета.
 * @returns {string} Цвет в формате, пригодном для UI.
 */
export function toUiColor(color: string): string {
    if (!color) return FALLBACK_COLOR;
    return color.startsWith('#') ? color : `#${color}`;
}

/**
 * Приводит цвет к API-формату.
 * @param {string} color - Исходное значение цвета.
 * @returns {string} Нормализованный цвет для отправки в API.
 */
export function toApiColor(color: string): string {
    const normalized = color.trim().replace(/^#/, '');
    return `#${normalized}`;
}

/**
 * Извлекает массив элементов из пагинированного ответа API.
 * @template T Тип элемента коллекции.
 * @param {PaginatedResponse<T>} [payload] - Пагинированный ответ API.
 * @returns {T[]} Массив элементов или пустой массив.
 */
export function getPaginatedItems<T>(payload?: PaginatedResponse<T>): T[] {
    return payload?.items ?? payload?.data ?? [];
}

/**
 * Извлекает общее количество элементов из пагинированного ответа API.
 * @param {PaginatedResponse<unknown>} [payload] - Пагинированный ответ API.
 * @returns {number} Общее количество элементов.
 */
export function getPaginatedTotal(payload?: PaginatedResponse<unknown>): number {
    return payload?.total_items ?? payload?.total ?? 0;
}

/**
 * Создаёт карту категорий по их идентификаторам.
 * @param {AssetCategory[]} categories - Список категорий.
 * @returns {Map<number, AssetCategory>} Карта вида `categoryId -> category`.
 */
export function createCategoryMap(categories: AssetCategory[]): Map<number, AssetCategory> {
    return new Map(categories.map(category => [category.id, { ...category, color: toUiColor(category.color) }]));
}

/**
 * Создаёт карту моделей по их идентификаторам.
 * @param {AssetModel[]} models - Список моделей.
 * @returns {Map<number, AssetModel>} Карта вида `modelId -> model`.
 */
export function createModelMap(models: AssetModel[]): Map<number, AssetModel> {
    return new Map(models.map(model => [model.id, model]));
}

/**
 * Создаёт карту статусов по их идентификаторам.
 * @param {AssetStatus[]} statuses - Список статусов.
 * @returns {Map<number, AssetStatus>} Карта вида `statusId -> status`.
 */
export function createStatusMap(statuses: AssetStatus[]): Map<number, AssetStatus> {
    return new Map(statuses.map(status => [status.id, { ...status, color: toUiColor(status.color) }]));
}

/**
 * Возвращает идентификатор категории модели независимо от формы поля `category`.
 * @param {AssetModel} model - Модель актива.
 * @returns {number} Идентификатор категории.
 */
function getModelCategoryId(model: AssetModel): number {
    return typeof model.category === 'number'
        ? model.category
        : model.category.id;
}

/**
 * Возвращает категорию для указанной модели.
 * @param {AssetModel} model - Модель актива.
 * @param {Map<number, AssetCategory>} categoryMap - Карта категорий.
 * @returns {AssetCategory | undefined} Найденная категория или `undefined`.
 */
export function getCategoryForModel(model: AssetModel, categoryMap: Map<number, AssetCategory>): AssetCategory | undefined {
    return categoryMap.get(getModelCategoryId(model));
}

/**
 * Возвращает модель для указанного актива.
 * @param {Asset} asset - Актив.
 * @param {Map<number, AssetModel>} modelMap - Карта моделей.
 * @returns {AssetModel | undefined} Найденная модель или `undefined`.
 */
export function getModelForAsset(asset: Asset, modelMap: Map<number, AssetModel>): AssetModel | undefined {
    return modelMap.get(asset.model_id);
}

/**
 * Возвращает статус для указанного актива.
 * @param {Asset} asset - Актив.
 * @param {Map<number, AssetStatus>} statusMap - Карта статусов.
 * @returns {AssetStatus | undefined} Найденный статус или `undefined`.
 */
export function getStatusForAsset(asset: Asset, statusMap: Map<number, AssetStatus>): AssetStatus | undefined {
    return statusMap.get(asset.status);
}

/**
 * Возвращает категорию для указанного актива через его модель.
 * @param {Asset} asset - Актив.
 * @param {Map<number, AssetModel>} modelMap - Карта моделей.
 * @param {Map<number, AssetCategory>} categoryMap - Карта категорий.
 * @returns {AssetCategory | undefined} Найденная категория или `undefined`.
 */
export function getCategoryForAsset(
    asset: Asset,
    modelMap: Map<number, AssetModel>,
    categoryMap: Map<number, AssetCategory>
): AssetCategory | undefined {
    const model = getModelForAsset(asset, modelMap);
    if (!model) return undefined;
    return getCategoryForModel(model, categoryMap);
}

/**
 * Возвращает цвет категории актива.
 * @param {Asset} asset - Актив.
 * @param {Map<number, AssetModel>} modelMap - Карта моделей.
 * @param {Map<number, AssetCategory>} categoryMap - Карта категорий.
 * @returns {string} Цвет категории в UI-формате.
 */
export function getCategoryColorForAsset(
    asset: Asset,
    modelMap: Map<number, AssetModel>,
    categoryMap: Map<number, AssetCategory>
): string {
    return getCategoryForAsset(asset, modelMap, categoryMap)?.color ?? FALLBACK_COLOR;
}
