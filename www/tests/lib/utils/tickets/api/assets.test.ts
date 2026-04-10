import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
};

vi.mock('$lib/utils/api', () => ({ api: apiMock }));

describe('Ticket assets API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('Requests linked assets by ticket id', async () => {
        const response = { success: true, data: [], status: 200 };
        apiMock.get.mockResolvedValue(response);

        const { getTicketAssets } = await import('$lib/utils/tickets/api/assets');
        const result = await getTicketAssets(123);

        expect(apiMock.get).toHaveBeenCalledWith('/api/v1/tickets/123/assets');
        expect(result).toEqual(response);
    });

    it('Supports string ticket id', async () => {
        const response = { success: true, data: [], status: 200 };
        apiMock.get.mockResolvedValue(response);

        const { getTicketAssets } = await import('$lib/utils/tickets/api/assets');
        await getTicketAssets('ticket-42');

        expect(apiMock.get).toHaveBeenCalledWith('/api/v1/tickets/ticket-42/assets');
    });

    it('Attach asset posts asset link payload', async () => {
        const response = { success: true, status: 200 };
        apiMock.post.mockResolvedValue(response);

        const { attachAssetToTicket } = await import('$lib/utils/tickets/api/assets');
        const payload = { asset_id: 55, comment: 'Проверен и закреплён' };
        const result = await attachAssetToTicket(321, payload);

        expect(apiMock.post).toHaveBeenCalledWith('/api/v1/tickets/321/assets', payload);
        expect(result).toEqual(response);
    });

    it('Attach asset works without comment', async () => {
        const response = { success: true, status: 200 };
        apiMock.post.mockResolvedValue(response);

        const { attachAssetToTicket } = await import('$lib/utils/tickets/api/assets');
        await attachAssetToTicket(321, { asset_id: 77 });

        expect(apiMock.post).toHaveBeenCalledWith('/api/v1/tickets/321/assets', { asset_id: 77 });
    });

    it('Deletes linked asset by ids', async () => {
        const response = { success: true, status: 200 };
        apiMock.delete.mockResolvedValue(response);

        const { deleteTicketAsset } = await import('$lib/utils/tickets/api/assets');
        const result = await deleteTicketAsset(321, 55);

        expect(apiMock.delete).toHaveBeenCalledWith('/api/v1/tickets/321/assets/55');
        expect(result).toEqual(response);
    });

    it('Supports string ids', async () => {
        const response = { success: true, status: 200 };
        apiMock.delete.mockResolvedValue(response);

        const { deleteTicketAsset } = await import('$lib/utils/tickets/api/assets');
        await deleteTicketAsset('ticket-321', 'asset-55');

        expect(apiMock.delete).toHaveBeenCalledWith('/api/v1/tickets/ticket-321/assets/asset-55');
    });
});
