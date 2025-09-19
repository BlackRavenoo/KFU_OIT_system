import { vi, describe, it, expect } from 'vitest';
import setupApiMock from '../../../apiClientMock';

describe('Admin api handlers', () => {
    it('Load items successfully with items/max_page object', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockResolvedValue({
            success: true,
            data: { items: [{ id: '1' }], max_page: 4 }
        });

        const { loadItems } = await import('$lib/utils/admin/api-handlers');
        const res = await loadItems<{ id: string }>({
            endpoint: '/test',
            currentPage: 2,
            itemsPerPage: 10,
            searchQuery: 'q'
        });

        expect(api.api.get).toHaveBeenCalledWith('/test', expect.objectContaining({
            page: 2,
            page_size: 10,
            search: 'q'
        }));
        expect(res.items).toEqual([{ id: '1' }]);
        expect(res.totalPages).toBe(4);
        expect(res.error).toBe(false);
    });

    it('Load items successfully with array data', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockResolvedValue({
            success: true,
            data: [{ a: 1 }, { a: 2 }]
        });

        const { loadItems } = await import('$lib/utils/admin/api-handlers');
        const res = await loadItems<any>({ endpoint: '/arr' });

        expect(res.items).toEqual([{ a: 1 }, { a: 2 }]);
        expect(res.totalPages).toBe(1);
        expect(res.error).toBe(false);
    });

    it('Handle 404 error', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockResolvedValue({ success: false, status: 404 });

        const { loadItems } = await import('$lib/utils/admin/api-handlers');
        const res = await loadItems<any>({ endpoint: '/not-found' });

        expect(res.items).toEqual([]);
        expect(res.totalPages).toBe(1);
        expect(res.error).toBe(false);
    });

    it('Handle 0 error', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockResolvedValue({ success: false, status: 0 });

        const { loadItems } = await import('$lib/utils/admin/api-handlers');
        const res = await loadItems<any>({ endpoint: '/net' });

        expect(res.error).toBe(true);
    });

    it('Handle 500 error', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockResolvedValue({ success: false, status: 500 });

        const { loadItems } = await import('$lib/utils/admin/api-handlers');
        const res = await loadItems<any>({ endpoint: '/net' });

        expect(res.error).toBe(true);
    });

    it('Catch 404 error and returns empty', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        const err: any = new Error('not found');
        err.response = { status: 404 };
        api.api.get = vi.fn().mockRejectedValue(err);

        const { loadItems } = await import('$lib/utils/admin/api-handlers');
        const res = await loadItems<any>({ endpoint: '/err' });

        expect(res.items).toEqual([]);
        expect(res.totalPages).toBe(1);
    });

    it('Catch other errors', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockRejectedValue(new Error('boom'));

        const { loadItems } = await import('$lib/utils/admin/api-handlers');
        const res = await loadItems<any>({ endpoint: '/err2' });

        expect(res.error).toBe(true);
    });

    it('Fallback when data or max_page are falsy', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');

        api.api.get = vi.fn().mockResolvedValue({
            success: true,
            data: { items: null, max_page: 0 }
        });

        const { loadItems } = await import('$lib/utils/admin/api-handlers');
        const res = await loadItems<any>({ endpoint: '/fallback' });

        expect(res.items).toEqual([]);
        expect(res.totalPages).toBe(1);
        expect(res.error).toBe(false);
    });

    it('Create item successfully', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const api = await import('$lib/utils/api');
        api.api.post = vi.fn().mockResolvedValue({ success: true, data: { id: 'x' } });

        const { createItem } = await import('$lib/utils/admin/api-handlers');
        const res = await createItem<{ id: string }>({ endpoint: '/c', data: { a: 1 }, successMessage: 'Y' });

        expect(api.api.post).toHaveBeenCalledWith('/c', { a: 1 });
        expect(notificationMock.notification).toHaveBeenCalledWith('Y', notificationMock.NotificationType.Success);
        expect(res.success).toBe(true);
        expect(res.data).toEqual({ id: 'x' });
    });

    it('Error during item creation', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const api = await import('$lib/utils/api');
        api.api.post = vi.fn().mockResolvedValue({ success: false, error: 'Bad' });

        const { createItem } = await import('$lib/utils/admin/api-handlers');
        const res = await createItem({ endpoint: '/c2', data: {} });

        expect(notificationMock.notification).toHaveBeenCalledWith('Bad', notificationMock.NotificationType.Error);
        expect(res.success).toBe(false);
    });

    it('Provided errorMessage when catch error during creation', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const api = await import('$lib/utils/api');
        api.api.post = vi.fn().mockResolvedValue({ success: false });

        const { createItem } = await import('$lib/utils/admin/api-handlers');
        const res = await createItem({ endpoint: '/c2', data: {}, errorMessage: 'Custom error occurred' });

        expect(notificationMock.notification).toHaveBeenCalledWith('Custom error occurred', notificationMock.NotificationType.Error);
        expect(res.success).toBe(false);
    });

    it('Create item catches exception and notifies error', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const api = await import('$lib/utils/api');
        api.api.post = vi.fn().mockRejectedValue(new Error('fail'));

        const { createItem } = await import('$lib/utils/admin/api-handlers');
        const res = await createItem({ endpoint: '/c3', data: {} });

        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка при создании', notificationMock.NotificationType.Error);
        expect(res.success).toBe(false);
    });

    it('Delete item successfully', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const api = await import('$lib/utils/api');
        api.api.delete = vi.fn().mockResolvedValue({ success: true });

        const { deleteItem } = await import('$lib/utils/admin/api-handlers');
        const res = await deleteItem({ endpoint: '/e', id: '123', successMessage: 'OK' });

        expect(api.api.delete).toHaveBeenCalledWith('/e/123');
        expect(notificationMock.notification).toHaveBeenCalledWith('OK', notificationMock.NotificationType.Success);
        expect(res).toBe(true);
    });

    it('Delete item failure', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const api = await import('$lib/utils/api');
        api.api.delete = vi.fn().mockResolvedValue({ success: false });

        const { deleteItem } = await import('$lib/utils/admin/api-handlers');
        const res = await deleteItem({ endpoint: '/e2', id: '456' });

        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка при удалении', notificationMock.NotificationType.Error);
        expect(res).toBe(false);
    });

    it('Delete item catches exception', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const api = await import('$lib/utils/api');
        api.api.delete = vi.fn().mockRejectedValue(new Error('boom'));

        const { deleteItem } = await import('$lib/utils/admin/api-handlers');
        const res = await deleteItem({ endpoint: '/e3', id: '789' });

        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка при удалении', notificationMock.NotificationType.Error);
        expect(res).toBe(false);
    });

    it('Response data not items/max_page or array', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockResolvedValue({
            success: true,
            data: { foo: 'bar' }
        });

        const { loadItems } = await import('$lib/utils/admin/api-handlers');
        const res = await loadItems<any>({ endpoint: '/weird' });

        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка при загрузке данных', notificationMock.NotificationType.Error);
        expect(res.error).toBe(true);
        expect(res.items).toEqual([]);
        expect(res.totalPages).toBe(1);
    });

    it('Response data is falsy', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockResolvedValue({
            success: true,
            data: null
        });

        const { loadItems } = await import('$lib/utils/admin/api-handlers');
        const res = await loadItems<any>({ endpoint: '/null-data' });

        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка при загрузке данных', notificationMock.NotificationType.Error);
        expect(res.error).toBe(true);
        expect(res.items).toEqual([]);
        expect(res.totalPages).toBe(1);
    });
});