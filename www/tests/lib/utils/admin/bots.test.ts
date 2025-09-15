import { vi, describe, it, expect } from 'vitest';
import setupApiMock from '../../../apiClientMock';

describe('Bots API', () => {
    it('Load list of bots data', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const loadItemsMock = vi.fn().mockResolvedValue({
            items: [{ id: '1', name: 'Bot1', token: 't1', active: true }],
            totalPages: 3,
            error: false
        });

        vi.doMock('$lib/utils/admin/api-handlers', () => ({
            loadItems: loadItemsMock,
            createItem: vi.fn(),
            deleteItem: vi.fn()
        }));

        const { loadBotsData } = await import('$lib/utils/admin/bots');
        const res = await loadBotsData(2, 10, 'query');

        expect(loadItemsMock).toHaveBeenCalledWith(expect.objectContaining({
            endpoint: '/api/v1/bots',
            currentPage: 2,
            itemsPerPage: 10,
            searchQuery: 'query'
        }));
        expect(res.bots).toEqual([{ id: '1', name: 'Bot1', token: 't1', active: true }]);
        expect(res.totalPages).toBe(3);
        expect(res.loading).toBe(false);
    });

    it('Create new bot notify if name is invalid', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        vi.doMock('$lib/utils/admin/api-handlers', () => ({
            loadItems: vi.fn(),
            createItem: vi.fn(),
            deleteItem: vi.fn()
        }));

        const { createBotData } = await import('$lib/utils/admin/bots');
        const result = await createBotData({ name: '   ' });

        expect(result).toBe(false);
        expect(notificationMock.notification).toHaveBeenCalledWith('Введите имя бота', notificationMock.NotificationType.Error);
    });

    it('Create new bot successfully', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const createItemMock = vi.fn().mockResolvedValue({ success: true });
        vi.doMock('$lib/utils/admin/api-handlers', () => ({
            loadItems: vi.fn(),
            createItem: createItemMock,
            deleteItem: vi.fn()
        }));

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const { createBotData } = await import('$lib/utils/admin/bots');
        const result = await createBotData({ name: 'New Bot' });

        expect(createItemMock).toHaveBeenCalledWith(expect.objectContaining({
            endpoint: '/api/v1/bots',
            data: { name: 'New Bot' }
        }));
        expect(result).toBe(true);
    });

    it('Delete bot successfully', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const deleteItemMock = vi.fn().mockResolvedValue({ success: true });
        vi.doMock('$lib/utils/admin/api-handlers', () => ({
            loadItems: vi.fn(),
            createItem: vi.fn(),
            deleteItem: deleteItemMock
        }));

        const { deleteBotData } = await import('$lib/utils/admin/bots');
        const result = await deleteBotData('bot-123');

        expect(deleteItemMock).toHaveBeenCalledWith(expect.objectContaining({
            endpoint: '/api/v1/bots',
            id: 'bot-123'
        }));
        expect(result).toEqual({ success: true });
    });

    it('Copy token to clipboard', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const writeTextMock = vi.fn().mockResolvedValue(undefined);
        (globalThis as any).navigator = { clipboard: { writeText: writeTextMock } };

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const { copyTokenToClipboard } = await import('$lib/utils/admin/bots');
        const result = await copyTokenToClipboard('token-xyz');

        expect(writeTextMock).toHaveBeenCalledWith('token-xyz');
        expect(notificationMock.notification).toHaveBeenCalledWith('Токен скопирован в буфер обмена', notificationMock.NotificationType.Success);
        expect(result).toBe(true);
    });

    it('Copy token to clipboard notifies on failure', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const writeTextMock = vi.fn().mockRejectedValue(new Error('no-clipboard'));
        (globalThis as any).navigator = { clipboard: { writeText: writeTextMock } };

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const { copyTokenToClipboard } = await import('$lib/utils/admin/bots');
        const result = await copyTokenToClipboard('token-xyz');

        expect(writeTextMock).toHaveBeenCalledWith('token-xyz');
        expect(notificationMock.notification).toHaveBeenCalledWith('Не удалось скопировать токен', notificationMock.NotificationType.Error);
        expect(result).toBe(false);
    });
});