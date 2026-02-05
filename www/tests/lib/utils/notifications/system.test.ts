import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as system from '$lib/utils/notifications/system';

import { api } from '$lib/utils/api';

vi.mock('$lib/utils/api', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
        put: vi.fn(),
    }
}));

describe('System notifications API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('Get system notifications with correct url', async () => {
        (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: [] });
        const res = await system.getSystemNotifications();
        expect(api.get).toHaveBeenCalledWith('/api/v1/system_notifications');
        expect(res).toEqual({ success: true, data: [] });
    });

    it('Create system notification with correct url and data', async () => {
        (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
        const data = { text: 'test', category: 0, active_until: null };
        const res = await system.createSystemNotification(data);
        expect(api.post).toHaveBeenCalledWith('/api/v1/system_notifications', data);
        expect(res).toEqual({ success: true });
    });

    it('Delete system notification with correct url', async () => {
        (api.delete as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
        const res = await system.deleteSystemNotification(42);
        expect(api.delete).toHaveBeenCalledWith('/api/v1/system_notifications/42');
        expect(res).toEqual({ success: true });
    });

    it('Update system notification with correct url and data', async () => {
        (api.put as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
        const data = { text: 'upd', category: 1, active_until: '2025-01-01T00:00' };
        const res = await system.updateSystemNotification(7, data);
        expect(api.put).toHaveBeenCalledWith('/api/v1/system_notifications/7', data);
        expect(res).toEqual({ success: true });
    });
});