import { vi, describe, it, expect } from 'vitest';
import setupApiMock from '../../../apiClientMock';

describe('Load personal user stats', () => {
    it('Original stats when userId is empty', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        const initial = { assignedToMe: 1, completedTickets: 2, cancelledTickets: 3 };
        const { loadUserStats } = await import('$lib/utils/account/stats');
        const res = await loadUserStats('', initial);

        expect(res).toEqual(initial);
        expect(api.api.get).not.toHaveBeenCalled();
    });

    it('Maps response data to stats', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockResolvedValue({
            success: true,
            data: {
                active_tickets_count: 5,
                closed_tickets_count: 7,
                cancelled_tickets_count: 9
            }
        });

        const initial = { assignedToMe: 0, completedTickets: 0, cancelledTickets: 0 };
        const { loadUserStats } = await import('$lib/utils/account/stats');
        const res = await loadUserStats('user-1', initial);

        expect(api.api.get).toHaveBeenCalledWith('/api/v1/user/stats?user_id=user-1');
        expect(res).toEqual({ assignedToMe: 5, completedTickets: 7, cancelledTickets: 9 });
    });

    it('Response fields are missing or falsy', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockResolvedValue({
            success: true,
            data: {}
        });

        const initial = { assignedToMe: 10, completedTickets: 10, cancelledTickets: 10 };
        const { loadUserStats } = await import('$lib/utils/account/stats');
        const res = await loadUserStats('user-2', initial);

        expect(res).toEqual({ assignedToMe: 0, completedTickets: 0, cancelledTickets: 0 });
    });

    it('Returns original stats when API fails', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockResolvedValue({ success: false });

        const initial = { assignedToMe: 1, completedTickets: 1, cancelledTickets: 1 };
        const { loadUserStats } = await import('$lib/utils/account/stats');

        const res = await loadUserStats('user-3', initial);

        expect(res).toEqual(initial);
    });

    it('Returns original stats on API error', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockRejectedValue(new Error('network'));

        const initial = { assignedToMe: 2, completedTickets: 3, cancelledTickets: 4 };
        const { loadUserStats } = await import('$lib/utils/account/stats');
        const res = await loadUserStats('user-4', initial);

        expect(res).toEqual(initial);
    });
});