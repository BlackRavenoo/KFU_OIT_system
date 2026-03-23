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

    it('`createAsset()` posts payload to assets endpoint', async () => {
        apiMock.post.mockResolvedValue({ success: true, data: { id: 11 }, status: 201 });

        const { createAsset } = await import('$lib/utils/assets/api');
        const payload = {
            name: 'ПК отдела кадров',
            model_id: 1,
            status: 2,
            location: 'Каб. 205',
        };

        await createAsset(payload);

        expect(apiMock.post).toHaveBeenCalledWith('/api/v1/assets', payload);
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
});
