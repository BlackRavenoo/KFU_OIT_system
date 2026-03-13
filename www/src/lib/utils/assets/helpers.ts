import type {
    Asset,
    AssetCategory,
    AssetModel,
    AssetStatus,
    PaginatedResponse,
} from '$lib/utils/assets/types';

const FALLBACK_COLOR = '#6B7280';

export function toUiColor(color: string): string {
    if (!color) return FALLBACK_COLOR;
    return color.startsWith('#') ? color : `#${color}`;
}

export function toApiColor(color: string): string {
    const normalized = color.trim().replace(/^#/, '');
    return `#${normalized}`;
}

export function getPaginatedItems<T>(payload?: PaginatedResponse<T>): T[] {
    return payload?.items ?? payload?.data ?? [];
}

export function getPaginatedTotal(payload?: PaginatedResponse<unknown>): number {
    return payload?.total_items ?? payload?.total ?? 0;
}

export function createCategoryMap(categories: AssetCategory[]): Map<number, AssetCategory> {
    return new Map(categories.map(category => [category.id, { ...category, color: toUiColor(category.color) }]));
}

export function createModelMap(models: AssetModel[]): Map<number, AssetModel> {
    return new Map(models.map(model => [model.id, model]));
}

export function createStatusMap(statuses: AssetStatus[]): Map<number, AssetStatus> {
    return new Map(statuses.map(status => [status.id, { ...status, color: toUiColor(status.color) }]));
}

export function getCategoryForModel(model: AssetModel, categoryMap: Map<number, AssetCategory>): AssetCategory | undefined {
    return categoryMap.get(model.category);
}

export function getModelForAsset(asset: Asset, modelMap: Map<number, AssetModel>): AssetModel | undefined {
    return modelMap.get(asset.model_id);
}

export function getStatusForAsset(asset: Asset, statusMap: Map<number, AssetStatus>): AssetStatus | undefined {
    return statusMap.get(asset.status);
}

export function getCategoryForAsset(
    asset: Asset,
    modelMap: Map<number, AssetModel>,
    categoryMap: Map<number, AssetCategory>
): AssetCategory | undefined {
    const model = getModelForAsset(asset, modelMap);
    if (!model) return undefined;
    return getCategoryForModel(model, categoryMap);
}

export function getCategoryColorForAsset(
    asset: Asset,
    modelMap: Map<number, AssetModel>,
    categoryMap: Map<number, AssetCategory>
): string {
    return getCategoryForAsset(asset, modelMap, categoryMap)?.color ?? FALLBACK_COLOR;
}
