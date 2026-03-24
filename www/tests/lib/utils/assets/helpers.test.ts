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

    it('Returns fallback color for empty color value', async () => {
        const { toUiColor } = await import('$lib/utils/assets/helpers');
        expect(toUiColor('')).toBe('#6B7280');
    });

    it('Adds hash prefix when color has no leading hash', async () => {
        const { toUiColor } = await import('$lib/utils/assets/helpers');
        expect(toUiColor('A1B2C3')).toBe('#A1B2C3');
    });

    it('Returns empty array when payload is missing', () => {
        expect(getPaginatedItems()).toEqual([]);
    });

    it('Returns zero when pagination payload is missing', () => {
        expect(getPaginatedTotal()).toBe(0);
    });

    it('Returns map with models indexed by id', async () => {
        const { createModelMap } = await import('$lib/utils/assets/helpers');
        const models = [
            { id: 10, name: 'Dell OptiPlex', category: 1 },
            { id: 11, name: 'HP LaserJet', category: 2 },
        ];
        const result = createModelMap(models);
        expect(result).toBeInstanceOf(Map);
        expect(result.size).toBe(2);
        expect(result.get(10)).toEqual(models[0]);
        expect(result.get(11)).toEqual(models[1]);
    });

    it('Returns map with statuses indexed by id', async () => {
        const { createStatusMap } = await import('$lib/utils/assets/helpers');
        const statuses = [
            { id: 1, name: 'In use', color: '112233' },
            { id: 2, name: 'Archived', color: '#445566' },
        ];
        const result = createStatusMap(statuses);
        expect(result).toBeInstanceOf(Map);
        expect(result.size).toBe(2);
        expect(result.get(1)).toEqual({ id: 1, name: 'In use', color: '#112233' });
        expect(result.get(2)).toEqual({ id: 2, name: 'Archived', color: '#445566' });
    });

    it('Returns matching status from map by asset status id', async () => {
        const { getStatusForAsset } = await import('$lib/utils/assets/helpers');
        const asset = { id: 200, name: 'Workstation', model_id: 10, status: 2 };
        const status = { id: 2, name: 'In use', color: '#00AA11' };
        const statusMap = new Map<number, typeof status>([[2, status]]);
        expect(getStatusForAsset(asset, statusMap)).toEqual(status);
    });
});
