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
 * @param color Исходное значение цвета.
 * @returns Цвет в формате, пригодном для UI.
 */
export function toUiColor(color: string): string {
    if (!color) return FALLBACK_COLOR;
    return color.startsWith('#') ? color : `#${color}`;
}

/**
 * Приводит цвет к API-формату.
 * @param color Исходное значение цвета.
 * @returns Нормализованный цвет для отправки в API.
 */
export function toApiColor(color: string): string {
    const normalized = color.trim().replace(/^#/, '');
    return `#${normalized}`;
}

/**
 * Извлекает массив элементов из пагинированного ответа API.
 * @template T Тип элемента коллекции.
 * @param payload Пагинированный ответ API.
 * @returns Массив элементов или пустой массив.
 */
export function getPaginatedItems<T>(payload?: PaginatedResponse<T>): T[] {
    return payload?.items ?? payload?.data ?? [];
}

/**
 * Извлекает общее количество элементов из пагинированного ответа API.
 * @param payload Пагинированный ответ API.
 * @returns Общее количество элементов.
 */
export function getPaginatedTotal(payload?: PaginatedResponse<unknown>): number {
    return payload?.total_items ?? payload?.total ?? 0;
}

/**
 * Создаёт карту категорий по их идентификаторам.
 * @param categories Список категорий.
 * @returns Карта вида `categoryId -> category`.
 */
export function createCategoryMap(categories: AssetCategory[]): Map<number, AssetCategory> {
    return new Map(categories.map(category => [category.id, { ...category, color: toUiColor(category.color) }]));
}

/**
 * Создаёт карту моделей по их идентификаторам.
 * @param models Список моделей.
 * @returns Карта вида `modelId -> model`.
 */
export function createModelMap(models: AssetModel[]): Map<number, AssetModel> {
    return new Map(models.map(model => [model.id, model]));
}

/**
 * Создаёт карту статусов по их идентификаторам.
 * @param statuses Список статусов.
 * @returns Карта вида `statusId -> status`.
 */
export function createStatusMap(statuses: AssetStatus[]): Map<number, AssetStatus> {
    return new Map(statuses.map(status => [status.id, { ...status, color: toUiColor(status.color) }]));
}

/**
 * Возвращает идентификатор категории модели независимо от формы поля `category`.
 * @param model Модель актива.
 * @returns Идентификатор категории.
 */
function getModelCategoryId(model: AssetModel): number {
    return typeof model.category === 'number'
        ? model.category
        : model.category.id;
}

/**
 * Возвращает категорию для указанной модели.
 * @param model Модель актива.
 * @param categoryMap Карта категорий.
 * @returns Найденная категория или `undefined`.
 */
export function getCategoryForModel(model: AssetModel, categoryMap: Map<number, AssetCategory>): AssetCategory | undefined {
    return categoryMap.get(getModelCategoryId(model));
}

/**
 * Возвращает модель для указанного актива.
 * @param asset Актив.
 * @param modelMap Карта моделей.
 * @returns Найденная модель или `undefined`.
 */
export function getModelForAsset(asset: Asset, modelMap: Map<number, AssetModel>): AssetModel | undefined {
    return modelMap.get(asset.model_id);
}

/**
 * Возвращает статус для указанного актива.
 * @param asset Актив.
 * @param statusMap Карта статусов.
 * @returns Найденный статус или `undefined`.
 */
export function getStatusForAsset(asset: Asset, statusMap: Map<number, AssetStatus>): AssetStatus | undefined {
    return statusMap.get(asset.status);
}

/**
 * Возвращает категорию для указанного актива через его модель.
 * @param asset Актив.
 * @param modelMap Карта моделей.
 * @param categoryMap Карта категорий.
 * @returns Найденная категория или `undefined`.
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
 * @param asset Актив.
 * @param modelMap Карта моделей.
 * @param categoryMap Карта категорий.
 * @returns Цвет категории в UI-формате.
 */
export function getCategoryColorForAsset(
    asset: Asset,
    modelMap: Map<number, AssetModel>,
    categoryMap: Map<number, AssetCategory>
): string {
    return getCategoryForAsset(asset, modelMap, categoryMap)?.color ?? FALLBACK_COLOR;
}
