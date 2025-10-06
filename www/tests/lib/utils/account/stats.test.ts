import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import setupApiMock from '../../../apiClientMock';

const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
});

const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('Load personal user stats', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.getItem.mockClear();
        localStorageMock.setItem.mockClear();
        localStorageMock.removeItem.mockClear();
        consoleWarnSpy.mockClear();
    });

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

describe('Get public stats with caching', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();
        localStorageMock.getItem.mockClear();
        localStorageMock.setItem.mockClear();
        localStorageMock.removeItem.mockClear();
        consoleWarnSpy.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Returns cached data when cache is valid', async () => {
        const cachedData = {
            timestamp: Date.now() - 5 * 60 * 1000,
            data: {
                todayCount: 10,
                totalCount: 100,
                percentOfSolutions: 85
            }
        };
        localStorageMock.getItem.mockReturnValue(JSON.stringify(cachedData));

        const api = await import('$lib/utils/api');
        const { getPublicStats } = await import('$lib/utils/account/stats');
        const result = await getPublicStats();

        expect(localStorageMock.getItem).toHaveBeenCalledWith('public_stats_cache');
        expect(api.api.get).not.toHaveBeenCalled();
        expect(result).toEqual({
            todayCount: 10,
            totalCount: 100,
            percentOfSolutions: 85
        });
    });

    it('Fetches new data when cache is expired', async () => {
        const expiredCachedData = {
            timestamp: Date.now() - 20 * 60 * 1000,
            data: {
                todayCount: 5,
                totalCount: 50,
                percentOfSolutions: 70
            }
        };
        localStorageMock.getItem.mockReturnValue(JSON.stringify(expiredCachedData));

        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockResolvedValue({
            success: true,
            data: {
                daily_tickets: 15,
                tickets_count: 150,
                percent_of_closed: 90
            }
        });

        const { getPublicStats } = await import('$lib/utils/account/stats');
        const result = await getPublicStats();

        expect(api.api.get).toHaveBeenCalledWith('/api/v1/tickets/stats');
        expect(localStorageMock.setItem).toHaveBeenCalledWith('public_stats_cache', 
            expect.stringContaining('"todayCount":15'));
        expect(result).toEqual({
            todayCount: 15,
            totalCount: 150,
            percentOfSolutions: 90
        });
    });

    it('Fetches new data when no cache exists', async () => {
        localStorageMock.getItem.mockReturnValue(null);

        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockResolvedValue({
            success: true,
            data: {
                daily_tickets: 20,
                tickets_count: 200,
                percent_of_closed: 95
            }
        });

        const { getPublicStats } = await import('$lib/utils/account/stats');
        const result = await getPublicStats();

        expect(api.api.get).toHaveBeenCalledWith('/api/v1/tickets/stats');
        expect(localStorageMock.setItem).toHaveBeenCalled();
        expect(result).toEqual({
            todayCount: 20,
            totalCount: 200,
            percentOfSolutions: 95
        });
    });

    it('Removes corrupted cache and fetches new data', async () => {
        localStorageMock.getItem.mockReturnValue('invalid json');

        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockResolvedValue({
            success: true,
            data: {
                daily_tickets: 25,
                tickets_count: 250,
                percent_of_closed: 80
            }
        });

        const { getPublicStats } = await import('$lib/utils/account/stats');
        const result = await getPublicStats();

        expect(localStorageMock.removeItem).toHaveBeenCalledWith('public_stats_cache');
        expect(api.api.get).toHaveBeenCalledWith('/api/v1/tickets/stats');
        expect(result).toEqual({
            todayCount: 25,
            totalCount: 250,
            percentOfSolutions: 80
        });
    });

    it('Uses fallback values when API response has missing fields', async () => {
        localStorageMock.getItem.mockReturnValue(null);

        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockResolvedValue({
            success: true,
            data: {}
        });

        const { getPublicStats } = await import('$lib/utils/account/stats');
        const result = await getPublicStats();

        expect(result).toEqual({
            todayCount: 0,
            totalCount: 0,
            percentOfSolutions: 0
        });
    });

    it('Uses fallback values for cached data when todayCount is falsy', async () => {
        const cachedData = {
            timestamp: Date.now() - 5 * 60 * 1000,
            data: {
                todayCount: null,
                totalCount: 100,
                percentOfSolutions: 85
            }
        };
        localStorageMock.getItem.mockReturnValue(JSON.stringify(cachedData));

        const api = await import('$lib/utils/api');
        const { getPublicStats } = await import('$lib/utils/account/stats');
        const result = await getPublicStats();

        expect(api.api.get).not.toHaveBeenCalled();
        expect(result).toEqual({
            todayCount: 0,
            totalCount: 100,
            percentOfSolutions: 85
        });
    });

    it('Returns fallback values when API fails', async () => {
        localStorageMock.getItem.mockReturnValue(null);

        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockResolvedValue({ success: false });

        const { getPublicStats } = await import('$lib/utils/account/stats');
        const result = await getPublicStats();

        expect(result).toEqual({
            todayCount: 0,
            totalCount: 0,
            percentOfSolutions: 0
        });
    });

    it('Returns fallback values on API error', async () => {
        localStorageMock.getItem.mockReturnValue(null);

        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockRejectedValue(new Error('Network error'));

        const { getPublicStats } = await import('$lib/utils/account/stats');
        const result = await getPublicStats();

        expect(result).toEqual({
            todayCount: 0,
            totalCount: 0,
            percentOfSolutions: 0
        });
    });

    it('Handles localStorage setItem error gracefully', async () => {
        localStorageMock.getItem.mockReturnValue(null);
        localStorageMock.setItem.mockImplementation(() => {
            throw new Error('Storage quota exceeded');
        });

        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockResolvedValue({
            success: true,
            data: {
                daily_tickets: 30,
                tickets_count: 300,
                percent_of_closed: 88
            }
        });

        const localConsoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const { getPublicStats } = await import('$lib/utils/account/stats');
        const result = await getPublicStats();

        expect(localConsoleWarnSpy).toHaveBeenCalledWith('Не удалось сохранить статистику в кеш');
        expect(result).toEqual({
            todayCount: 30,
            totalCount: 300,
            percentOfSolutions: 88
        });

        localConsoleWarnSpy.mockRestore();
    });

    it('Uses fallback values for cached data with missing fields', async () => {
        const cachedData = {
            timestamp: Date.now() - 5 * 60 * 1000,
            data: {
                todayCount: 12
            }
        };
        localStorageMock.getItem.mockReturnValue(JSON.stringify(cachedData));

        const api = await import('$lib/utils/api');
        const { getPublicStats } = await import('$lib/utils/account/stats');
        const result = await getPublicStats();

        expect(api.api.get).not.toHaveBeenCalled();
        expect(result).toEqual({
            todayCount: 12,
            totalCount: 0,
            percentOfSolutions: 0
        });
    });
});