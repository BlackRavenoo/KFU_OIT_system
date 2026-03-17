import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
};

vi.mock('$lib/utils/api', () => ({ api: apiMock }));

describe('Statuses API utils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('`getStatuses()` clamps `page_size` to max 100', async () => {
        apiMock.get.mockResolvedValue({ success: true, data: { items: [] }, status: 200 });

        const { getStatuses } = await import('$lib/utils/assets/statuses-api');
        await getStatuses({ page: 1, page_size: 999, sort_order: 'asc' });

        expect(apiMock.get).toHaveBeenCalledWith('/api/v1/assets/statuses', {
            page: 1,
            page_size: 100,
            sort_order: 'asc',
        });
    });

    it('`getStatuses()` clamps `page_size` to min 10', async () => {
        apiMock.get.mockResolvedValue({ success: true, data: { items: [] }, status: 200 });

        const { getStatuses } = await import('$lib/utils/assets/statuses-api');
        await getStatuses({ page: 1, page_size: 1 });

        expect(apiMock.get).toHaveBeenCalledWith('/api/v1/assets/statuses', {
            page: 1,
            page_size: 10,
        });
    });

    it('`createStatus()` normalizes color', async () => {
        apiMock.post.mockResolvedValue({ success: true, data: { id: 1 }, status: 201 });

        const { createStatus } = await import('$lib/utils/assets/statuses-api');
        await createStatus({ name: 'В ремонте', color: 'FFCC00' });

        expect(apiMock.post).toHaveBeenCalledWith('/api/v1/assets/statuses', {
            name: 'В ремонте',
            color: '#FFCC00',
        });
    });

    it('`updateStatus()` normalizes color only when provided', async () => {
        apiMock.put.mockResolvedValue({ success: true, status: 200 });

        const { updateStatus } = await import('$lib/utils/assets/statuses-api');
        await updateStatus(7, { name: 'Используется', color: '#00aa11' });
        await updateStatus(8, { name: 'Списан' });

        expect(apiMock.put).toHaveBeenNthCalledWith(1, '/api/v1/assets/statuses/7', {
            name: 'Используется',
            color: '#00aa11',
        });
        expect(apiMock.put).toHaveBeenNthCalledWith(2, '/api/v1/assets/statuses/8', {
            name: 'Списан',
        });
    });

    it('`deleteStatus()` calls delete endpoint', async () => {
        apiMock.delete.mockResolvedValue({ success: true, status: 200 });

        const { deleteStatus } = await import('$lib/utils/assets/statuses-api');
        await deleteStatus(42);

        expect(apiMock.delete).toHaveBeenCalledWith('/api/v1/assets/statuses/42');
    });
});
