import { vi, describe, it, expect } from 'vitest';
import setupApiMock from '../../../apiClientMock';

describe('Administration users', () => {
    it('Load array of users data', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const loadItemsMock = vi.fn().mockResolvedValue({
            items: [{ id: 'u1', name: 'User1', email: 'u1@example.com', role: 'admin' }],
            totalPages: 5,
            error: false
        });

        vi.doMock('$lib/utils/admin/api-handlers', () => ({
            loadItems: loadItemsMock,
            createItem: vi.fn()
        }));

        const { loadUsersData } = await import('$lib/utils/admin/users');
        const res = await loadUsersData(1, 20, 'search');

        expect(loadItemsMock).toHaveBeenCalledWith(expect.objectContaining({
            endpoint: '/api/v1/user/list',
            currentPage: 1,
            itemsPerPage: 20,
            searchQuery: 'search'
        }));
        expect(res.users).toEqual([{ id: 'u1', name: 'User1', email: 'u1@example.com', role: 'admin' }]);
        expect(res.totalPages).toBe(5);
        expect(res.error).toBe(false);
    });

    it('Validate email on various scenarios', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const { validateEmail } = await import('$lib/utils/setup/validate');

        expect(validateEmail('')).toBe(false);
        expect(validateEmail('invalid-email')).toBe(false);
        expect(validateEmail('a@b.c')).toBe(true);
        expect(validateEmail('user@example.com')).toBe(true);
        expect(validateEmail('user.name+tag@sub.domain.co')).toBe(true);
    });

    it('Returns false on invalid email during invitation', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);
        vi.doMock('$lib/utils/admin/api-handlers', () => ({
            loadItems: vi.fn(),
            createItem: vi.fn()
        }));

        const { sendInvitation } = await import('$lib/utils/admin/users');
        const result = await sendInvitation('bad-email');

        expect(result).toBe(false);
        expect(notificationMock.notification).toHaveBeenCalledWith('Пожалуйста, введите корректный email', notificationMock.NotificationType.Error);
    });

    it('Send invitation successfully', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const createItemMock = vi.fn().mockResolvedValue({ success: true });
        vi.doMock('$lib/utils/admin/api-handlers', () => ({
            loadItems: vi.fn(),
            createItem: createItemMock
        }));

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const { sendInvitation } = await import('$lib/utils/admin/users');
        const result = await sendInvitation('invite@example.com');

        expect(createItemMock).toHaveBeenCalledWith(expect.objectContaining({
            endpoint: '/api/v1/user/admin/invite',
            data: { email: 'invite@example.com' }
        }));
        expect(result).toBe(true);
    });

    it('Send invitation error', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const createItemMock = vi.fn().mockResolvedValue({ success: false });
        vi.doMock('$lib/utils/admin/api-handlers', () => ({
            loadItems: vi.fn(),
            createItem: createItemMock
        }));

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const { sendInvitation } = await import('$lib/utils/admin/users');
        const result = await sendInvitation('invite@example.com');

        expect(result).toBe(false);
        expect(createItemMock).toHaveBeenCalled();
    });

    it('Delete user successfully', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const apiModule = await import('$lib/utils/api');
        apiModule.api.patch = vi.fn().mockResolvedValue({ success: true });

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const { deleteUserData } = await import('$lib/utils/admin/users');
        const result = await deleteUserData('user-1');

        expect(apiModule.api.patch).toHaveBeenCalledWith('/api/v1/user/admin/status', { id: 'user-1', status: 'Inactive' });
        expect(notificationMock.notification).toHaveBeenCalledWith('Пользователь успешно удален', notificationMock.NotificationType.Success);
        expect(result).toBe(true);
    });

    it('Delete user error and notifies on failure', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const apiModule = await import('$lib/utils/api');
        apiModule.api.patch = vi.fn().mockResolvedValue({ success: false });

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const { deleteUserData } = await import('$lib/utils/admin/users');
        const result = await deleteUserData('user-2');

        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка при удалении пользователя', notificationMock.NotificationType.Error);
        expect(result).toBe(false);
    });

    it('Delete user catches errors and notifies on exception', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const apiModule = await import('$lib/utils/api');
        apiModule.api.patch = vi.fn().mockRejectedValue(new Error('network'));

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const { deleteUserData } = await import('$lib/utils/admin/users');
        const result = await deleteUserData('user-3');

        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка при удалении пользователя', notificationMock.NotificationType.Error);
        expect(result).toBe(false);
    });

    it('Change user role successfully', async () => {
    vi.resetModules();
    vi.clearAllMocks();
    setupApiMock();

    const apiModule = await import('$lib/utils/api');
    apiModule.api.patch = vi.fn().mockResolvedValue({ success: true });

    const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
    vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

    const { changeRole } = await import('$lib/utils/admin/users');
    const result = await changeRole('user-1', 'admin');

    expect(apiModule.api.patch).toHaveBeenCalledWith('/api/v1/user/admin/role', { id: 'user-1', role: 'admin' });
    expect(notificationMock.notification).toHaveBeenCalledWith('Роль успешно изменена', notificationMock.NotificationType.Success);
    expect(result).toBe(true);
});

it('Change user role error and notifies on failure', async () => {
    vi.resetModules();
    vi.clearAllMocks();
    setupApiMock();

    const apiModule = await import('$lib/utils/api');
    apiModule.api.patch = vi.fn().mockResolvedValue({ success: false });

    const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
    vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

    const { changeRole } = await import('$lib/utils/admin/users');
    const result = await changeRole('user-2', 'moderator');

    expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка при обновлении роли пользователя', notificationMock.NotificationType.Error);
    expect(result).toBe(false);
});

it('Change user role catches errors and notifies on exception', async () => {
    vi.resetModules();
    vi.clearAllMocks();
    setupApiMock();

    const apiModule = await import('$lib/utils/api');
    apiModule.api.patch = vi.fn().mockRejectedValue(new Error('network'));

    const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
    vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

    const { changeRole } = await import('$lib/utils/admin/users');
    const result = await changeRole('user-3', 'programmer');

    expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка при обновлении роли пользователя', notificationMock.NotificationType.Error);
    expect(result).toBe(false);
});
});