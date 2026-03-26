import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
};

vi.mock('$lib/utils/api', () => ({ api: apiMock }));

describe('Assets API utils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('`getAssets()` requests assets list with params', async () => {
        apiMock.get.mockResolvedValue({ success: true, data: { items: [] }, status: 200 });

        const { getAssets } = await import('$lib/utils/assets/api');
        await getAssets({ page: 2, page_size: 25, name: 'pc' });

        expect(apiMock.get).toHaveBeenCalledWith('/api/v1/assets', {
            page: 2,
            page_size: 25,
            name: 'pc',
        });
    });

    it('`createAsset()` posts multipart payload to assets endpoint', async () => {
        apiMock.post.mockResolvedValue({ success: true, data: { id: 11 }, status: 201 });

        const { createAsset } = await import('$lib/utils/assets/api');
        const payload = {
            name: 'ПК отдела кадров',
            model_id: 1,
            status: 2,
            location: 'Каб. 205',
        };

        await createAsset(payload);

        expect(apiMock.post).toHaveBeenCalledWith('/api/v1/assets', expect.any(FormData));

        const sentBody = apiMock.post.mock.calls[0][1] as FormData;
        const fields = sentBody.get('fields');

        expect(typeof sentBody.has === 'function' ? sentBody.has('fields') : !!fields).toBe(true);
        expect(sentBody.get('photo')).toBeNull();

        if (typeof fields === 'string') {
            expect(JSON.parse(fields)).toEqual(payload);
        }
    });

    it('`createAsset()` appends photo to multipart payload when provided', async () => {
        apiMock.post.mockResolvedValue({ success: true, data: { id: 12 }, status: 201 });

        const { createAsset } = await import('$lib/utils/assets/api');
        const photo = typeof File !== 'undefined'
            ? new File(['fake-image'], 'asset.png', { type: 'image/png' })
            : Object.assign(new Blob(['fake-image'], { type: 'image/png' }), { name: 'asset.png' }) as File;

        const payload = {
            name: 'Фото актив',
            model_id: 2,
            status: 1,
            photo,
        };

        await createAsset(payload);

        expect(apiMock.post).toHaveBeenCalledWith('/api/v1/assets', expect.any(FormData));

        const sentBody = apiMock.post.mock.calls[0][1] as FormData;
        expect(typeof sentBody.has === 'function' ? sentBody.has('photo') : !!sentBody.get('photo')).toBe(true);
        expect(sentBody.get('photo')).toBeTruthy();
    });

    it('`updateAsset()` puts payload to asset endpoint', async () => {
        apiMock.put.mockResolvedValue({ success: true, status: 200 });

        const { updateAsset } = await import('$lib/utils/assets/api');
        const payload = {
            name: 'ПК отдела кадров (обновлён)',
            location: 'Каб. 207',
        };

        await updateAsset(11, payload);

        expect(apiMock.put).toHaveBeenCalledWith('/api/v1/assets/11', payload);
    });

    it('`deleteAsset()` calls delete endpoint', async () => {
        apiMock.delete.mockResolvedValue({ success: true, status: 200 });

        const { deleteAsset } = await import('$lib/utils/assets/api');
        await deleteAsset(11);

        expect(apiMock.delete).toHaveBeenCalledWith('/api/v1/assets/11');
    });

    it('`createCategory()` converts color to API format', async () => {
        apiMock.post.mockResolvedValue({ success: true, data: { id: 1 }, status: 201 });

        const { createCategory } = await import('$lib/utils/assets/api');
        await createCategory({ name: 'Ноутбуки', color: 'AABBCC' });

        expect(apiMock.post).toHaveBeenCalledWith('/api/v1/assets/categories', {
            name: 'Ноутбуки',
            color: '#AABBCC',
        });
    });

    it('Returns response from categories request', async () => {
        const response = { success: true, data: { items: [] }, status: 200 };
        apiMock.get.mockResolvedValue(response);
        const { getCategories } = await import('$lib/utils/assets/api');
        const result = await getCategories();
        expect(apiMock.get).toHaveBeenCalledWith('/api/v1/assets/categories', {});
        expect(result).toEqual(response);
    });

    it('Returns api response with normalized category payload', async () => {
        const response = { success: true, status: 200 };
        apiMock.put.mockResolvedValue(response);
        const { updateCategory } = await import('$lib/utils/assets/api');
        const payload = { name: 'Мониторы', color: 'AABBCC' };
        const result = await updateCategory(7, payload);
        expect(apiMock.put).toHaveBeenCalledWith('/api/v1/assets/categories/7', {
            name: 'Мониторы',
            color: '#AABBCC',
        });
        expect(result).toEqual(response);
    });

    it('Sets fallback color when color is missing', async () => {
        const response = { success: true, status: 200 };
        apiMock.put.mockResolvedValue(response);
        const { updateCategory } = await import('$lib/utils/assets/api');
        const result = await updateCategory(7, { name: 'Мониторы' });
        expect(apiMock.put).toHaveBeenCalledWith('/api/v1/assets/categories/7', {
            name: 'Мониторы',
            color: '#',
        });
        expect(result).toEqual(response);
    });

    it('Returns response from delete request', async () => {
        const response = { success: true, status: 200 };
        apiMock.delete.mockResolvedValue(response);
        const { deleteCategory } = await import('$lib/utils/assets/api');
        const result = await deleteCategory(7);
        expect(apiMock.delete).toHaveBeenCalledWith('/api/v1/assets/categories/7');
        expect(result).toEqual(response);
    });

    it('Returns response from models request', async () => {
        const response = { success: true, data: { items: [] }, status: 200 };
        apiMock.get.mockResolvedValue(response);
        const { getModels } = await import('$lib/utils/assets/api');
        const result = await getModels();
        expect(apiMock.get).toHaveBeenCalledWith('/api/v1/assets/models', {});
        expect(result).toEqual(response);
    });

    it('Returns response from model create request', async () => {
        const response = { success: true, data: { id: 15 }, status: 201 };
        apiMock.post.mockResolvedValue(response);
        const { createModel } = await import('$lib/utils/assets/api');
        const payload = { name: 'Office PC', category: 1 } as any;
        const result = await createModel(payload);
        expect(apiMock.post).toHaveBeenCalledWith('/api/v1/assets/models', payload);
        expect(result).toEqual(response);
    });

    it('Returns response from model update request', async () => {
        const response = { success: true, status: 200 };
        apiMock.put.mockResolvedValue(response);
        const { updateModel } = await import('$lib/utils/assets/api');
        const payload = { name: 'Office PC Gen 2', category: 2 } as any;
        const result = await updateModel(15, payload);
        expect(apiMock.put).toHaveBeenCalledWith('/api/v1/assets/models/15', payload);
        expect(result).toEqual(response);
    });

    it('Returns response from model remove request', async () => {
        const response = { success: true, status: 200 };
        apiMock.delete.mockResolvedValue(response);
        const { deleteModel } = await import('$lib/utils/assets/api');
        const result = await deleteModel(15);
        expect(apiMock.delete).toHaveBeenCalledWith('/api/v1/assets/models/15');
        expect(result).toEqual(response);
    });

    it('Handles missing params with empty object fallback', async () => {
        const response = { success: true, data: { items: [] }, status: 200 };
        apiMock.get.mockResolvedValue(response);
        const { getAssets } = await import('$lib/utils/assets/api');
        const result = await getAssets();
        expect(apiMock.get).toHaveBeenCalledWith('/api/v1/assets', {});
        expect(result).toEqual(response);
    });
});
