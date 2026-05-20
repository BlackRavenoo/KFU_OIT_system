import { vi, describe, it, expect, beforeEach } from 'vitest';
import setupApiMock from '../../../apiClientMock';

describe('Admin Transfer', () => {
    let apiMock: ReturnType<typeof setupApiMock>['apiMock'];

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        ({ apiMock } = setupApiMock());
    });

    it('Validate admin transfer token returns data on success', async () => {
        const payload = { from_user_id: 1, to_user_id: 2 };
        apiMock.post.mockResolvedValueOnce({ success: true, data: payload, status: 200 });

        const { validateAdminTransferToken } = await import('$lib/utils/admin/admin-transfer');
        const result = await validateAdminTransferToken('valid-token');

        expect(apiMock.post).toHaveBeenCalledWith(
            '/api/v1/auth/admin_transfer/validate',
            { token: 'valid-token' }
        );
        expect(result).toEqual(payload);
    });

    it('Validate admin transfer token returns null if is not success', async () => {
        apiMock.post.mockResolvedValueOnce({ success: false, status: 400 });

        const { validateAdminTransferToken } = await import('$lib/utils/admin/admin-transfer');
        const result = await validateAdminTransferToken('bad-token');

        expect(result).toBeNull();
    });

    it('Validate admin transfer token returns null if data is missing', async () => {
        apiMock.post.mockResolvedValueOnce({ success: true, data: undefined, status: 200 });

        const { validateAdminTransferToken } = await import('$lib/utils/admin/admin-transfer');
        const result = await validateAdminTransferToken('token');

        expect(result).toBeNull();
    });

    it('Validate admin transfer token returns null on exception', async () => {
        apiMock.post.mockRejectedValueOnce(new Error('network error'));

        const { validateAdminTransferToken } = await import('$lib/utils/admin/admin-transfer');
        const result = await validateAdminTransferToken('token');

        expect(result).toBeNull();
    });

    it('Confirm admin transfer returns true and shows notification on success', async () => {
        apiMock.post.mockResolvedValueOnce({ success: true, status: 200 });
        const notificationMock = { notification: vi.fn() };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);
        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Success: 'success', Error: 'error' } }));

        const { confirmAdminTransfer } = await import('$lib/utils/admin/admin-transfer');
        const result = await confirmAdminTransfer('valid-token');

        expect(apiMock.post).toHaveBeenCalledWith(
            '/api/v1/auth/admin_transfer/confirm',
            { token: 'valid-token' }
        );
        expect(result).toBe(true);
        expect(notificationMock.notification).toHaveBeenCalledWith(
            'Права администратора успешно переданы',
            'success'
        );
    });

    it('Confirm admin transfer returns false and shows error on unsuccessful response', async () => {
        apiMock.post.mockResolvedValueOnce({ success: false, status: 400 });
        const notificationMock = { notification: vi.fn() };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);
        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Success: 'success', Error: 'error' } }));

        const { confirmAdminTransfer } = await import('$lib/utils/admin/admin-transfer');
        const result = await confirmAdminTransfer('bad-token');

        expect(result).toBe(false);
        expect(notificationMock.notification).toHaveBeenCalledWith(
            'Ошибка при подтверждении передачи прав',
            'error'
        );
    });

    it('Confirm admin transfer returns false and shows error on exception', async () => {
        apiMock.post.mockRejectedValueOnce(new Error('network error'));
        const notificationMock = { notification: vi.fn() };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);
        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Success: 'success', Error: 'error' } }));

        const { confirmAdminTransfer } = await import('$lib/utils/admin/admin-transfer');
        const result = await confirmAdminTransfer('token');

        expect(result).toBe(false);
        expect(notificationMock.notification).toHaveBeenCalledWith(
            'Ошибка при подтверждении передачи прав',
            'error'
        );
    });

    it('Request admin transfer returns true and shows notification on success', async () => {
        apiMock.post.mockResolvedValueOnce({ success: true, status: 200 });
        const notificationMock = { notification: vi.fn() };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);
        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Success: 'success', Error: 'error' } }));

        const { requestAdminTransfer } = await import('$lib/utils/admin/admin-transfer');
        const result = await requestAdminTransfer('42');

        expect(apiMock.post).toHaveBeenCalledWith(
            '/api/v1/user/admin/transfer',
            { user_id: 42 }
        );
        expect(result).toBe(true);
        expect(notificationMock.notification).toHaveBeenCalledWith(
            'Запрос на передачу прав отправлен. Пользователь получит письмо с подтверждением.',
            'success'
        );
    });

    it('Request admin transfer parses userId to number', async () => {
        apiMock.post.mockResolvedValueOnce({ success: true, status: 200 });
        vi.doMock('$lib/utils/notifications/notification', () => ({ notification: vi.fn() }));
        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Success: 'success', Error: 'error' } }));

        const { requestAdminTransfer } = await import('$lib/utils/admin/admin-transfer');
        await requestAdminTransfer('7');

        expect(apiMock.post).toHaveBeenCalledWith(
            '/api/v1/user/admin/transfer',
            { user_id: 7 }
        );
    });

    it('Request admin transfer returns false and shows error on unsuccessful response', async () => {
        apiMock.post.mockResolvedValueOnce({ success: false, status: 403 });
        const notificationMock = { notification: vi.fn() };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);
        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Success: 'success', Error: 'error' } }));

        const { requestAdminTransfer } = await import('$lib/utils/admin/admin-transfer');
        const result = await requestAdminTransfer('5');

        expect(result).toBe(false);
        expect(notificationMock.notification).toHaveBeenCalledWith(
            'Ошибка при отправке запроса на передачу прав',
            'error'
        );
    });

    it('Request admin transfer returns false and shows error on exception', async () => {
        apiMock.post.mockRejectedValueOnce(new Error('network error'));
        const notificationMock = { notification: vi.fn() };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);
        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Success: 'success', Error: 'error' } }));

        const { requestAdminTransfer } = await import('$lib/utils/admin/admin-transfer');
        const result = await requestAdminTransfer('5');

        expect(result).toBe(false);
        expect(notificationMock.notification).toHaveBeenCalledWith(
            'Ошибка при отправке запроса на передачу прав',
            'error'
        );
    });
});
