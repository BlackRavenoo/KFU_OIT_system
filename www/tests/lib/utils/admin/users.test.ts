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

        const { validateEmail } = await import('$lib/utils/validation/validate');

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

    it('Set user status successfully', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const apiModule = await import('$lib/utils/api');
        apiModule.api.patch = vi.fn().mockResolvedValue({ success: true });

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const { UserStatus } = await import('$lib/utils/auth/types');
        const { setUserStatus } = await import('$lib/utils/admin/users');
        
        const result = await setUserStatus(123, UserStatus.Sick);

        expect(apiModule.api.patch).toHaveBeenCalledWith('/api/v1/user/status', { 
            id: 123, 
            status: UserStatus.Sick 
        });
        expect(result).toBe(true);
        expect(notificationMock.notification).not.toHaveBeenCalled();
    });

    it('Set user status error and notifies on failure', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const apiModule = await import('$lib/utils/api');
        apiModule.api.patch = vi.fn().mockResolvedValue({ success: false });

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const { UserStatus } = await import('$lib/utils/auth/types');
        const { setUserStatus } = await import('$lib/utils/admin/users');
        
        const result = await setUserStatus(456, UserStatus.Vacation);

        expect(apiModule.api.patch).toHaveBeenCalledWith('/api/v1/user/status', { 
            id: 456, 
            status: UserStatus.Vacation 
        });
        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка при смене статуса', notificationMock.NotificationType.Error);
        expect(result).toBe(false);
    });

    it('Set user status catches errors and notifies on exception', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const apiModule = await import('$lib/utils/api');
        apiModule.api.patch = vi.fn().mockRejectedValue(new Error('Network error'));

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const { UserStatus } = await import('$lib/utils/auth/types');
        const { setUserStatus } = await import('$lib/utils/admin/users');
        
        const result = await setUserStatus(789, UserStatus.Active);

        expect(apiModule.api.patch).toHaveBeenCalledWith('/api/v1/user/status', { 
            id: 789, 
            status: UserStatus.Active 
        });
        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка при смене статуса', notificationMock.NotificationType.Error);
        expect(result).toBe(false);
    });

    it('Set user status with all possible status values', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const apiModule = await import('$lib/utils/api');
        apiModule.api.patch = vi.fn().mockResolvedValue({ success: true });

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const { UserStatus } = await import('$lib/utils/auth/types');
        const { setUserStatus } = await import('$lib/utils/admin/users');
        
        await setUserStatus(1, UserStatus.Active);
        expect(apiModule.api.patch).toHaveBeenCalledWith('/api/v1/user/status', { 
            id: 1, 
            status: UserStatus.Active 
        });

        await setUserStatus(2, UserStatus.Sick);
        expect(apiModule.api.patch).toHaveBeenCalledWith('/api/v1/user/status', { 
            id: 2, 
            status: UserStatus.Sick 
        });

        await setUserStatus(3, UserStatus.Vacation);
        expect(apiModule.api.patch).toHaveBeenCalledWith('/api/v1/user/status', { 
            id: 3, 
            status: UserStatus.Vacation 
        });

        expect(apiModule.api.patch).toHaveBeenCalledTimes(3);
        expect(notificationMock.notification).not.toHaveBeenCalled();
    });
});