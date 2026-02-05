import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/utils/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn()
    }
}));

import api from '$lib/utils/api';
import {
    getUserNotificationsCount,
    getUserNotifications,
    markUserNotificationsAsRead
} from '$lib/utils/notifications/api';

describe('notifications/api', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('getUserNotificationsCount returns count', async () => {
        (api.get as any).mockResolvedValue({ data: { count: 7 } });
        const count = await getUserNotificationsCount();
        expect(api.get).toHaveBeenCalledWith('/api/v1/notifications/count');
        expect(count).toBe(7);
    });

    it('getUserNotifications returns notifications array', async () => {
        const notifications = [
            { id: 1, read: false, created_at: '2024-01-01', payload: {}, ticket_id: 123 },
            { id: 2, read: true, created_at: '2024-01-02', payload: {}, ticket_id: 124 }
        ];
        (api.get as any).mockResolvedValue({ data: notifications });
        const result = await getUserNotifications({ before: 10, limit: 2 });
        expect(api.get).toHaveBeenCalledWith('/api/v1/notifications', { params: { before: 10, limit: 2 } });
        expect(result).toEqual(notifications);
    });

    it('getUserNotifications uses default limit when params not provided', async () => {
        (api.get as any).mockResolvedValue({ data: [] });
        await getUserNotifications();
        expect(api.get).toHaveBeenCalledWith('/api/v1/notifications', { params: { limit: 20 } });
    });

    it('markUserNotificationsAsRead calls post and returns data', async () => {
        (api.post as any).mockResolvedValue({ data: undefined });
        await markUserNotificationsAsRead([1, 2, 3]);
        expect(api.post).toHaveBeenCalledWith('/api/v1/notifications/read', { notification_ids: [1, 2, 3] });
    });
});