import { describe, expect, it } from 'vitest';

import {
    createCategoryMap,
    getCategoryColorForAsset,
    getCategoryForAsset,
    getCategoryForModel,
    getPaginatedItems,
    getPaginatedTotal,
} from '$lib/utils/assets/helpers';
import type { Asset, AssetCategory, AssetModel } from '$lib/utils/assets/types';

describe('Assets helpers', () => {
    const categories: AssetCategory[] = [
        { id: 1, name: 'ПК', color: '#112233' },
        { id: 2, name: 'Принтеры', color: '#445566' },
    ];

    it('`getCategoryForModel()` works with numeric model category', () => {
        const categoryMap = createCategoryMap(categories);
        const model: AssetModel = { id: 10, name: 'Dell OptiPlex', category: 1 };

        expect(getCategoryForModel(model, categoryMap)?.name).toBe('ПК');
    });

    it('`getCategoryForModel()` works with object model category', () => {
        const categoryMap = createCategoryMap(categories);
        const model: AssetModel = {
            id: 11,
            name: 'HP LaserJet',
            category: { id: 2, name: 'Принтеры', color: '#445566' },
        };

        expect(getCategoryForModel(model, categoryMap)?.name).toBe('Принтеры');
    });

    it('`getCategoryForAsset()` and `getCategoryColorForAsset()` resolve category via model map', () => {
        const categoryMap = createCategoryMap(categories);
        const modelMap = new Map<number, AssetModel>([[10, { id: 10, name: 'Dell', category: 1 }]]);
        const asset: Asset = { id: 100, name: 'ПК 1', model_id: 10, status: 1 };

        expect(getCategoryForAsset(asset, modelMap, categoryMap)?.id).toBe(1);
        expect(getCategoryColorForAsset(asset, modelMap, categoryMap)).toBe('#112233');
    });

    it('`getCategoryColorForAsset()` returns fallback color when model/category is missing', () => {
        const categoryMap = createCategoryMap(categories);
        const modelMap = new Map<number, AssetModel>();
        const asset: Asset = { id: 101, name: 'Неизвестный', model_id: 999, status: 1 };

        expect(getCategoryColorForAsset(asset, modelMap, categoryMap)).toBe('#6B7280');
    });

    it('pagination helpers read both legacy and new keys', () => {
        expect(getPaginatedItems({ items: [1, 2] })).toEqual([1, 2]);
        expect(getPaginatedItems({ data: [3] })).toEqual([3]);

        expect(getPaginatedTotal({ total_items: 7 })).toBe(7);
        expect(getPaginatedTotal({ total: 5 })).toBe(5);
    });
});
