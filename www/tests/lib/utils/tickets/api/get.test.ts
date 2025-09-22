import { vi } from 'vitest';

vi.mock('$lib/utils/tickets/stores', () => {
    const mockFilters = {
        search: '',
        viewMode: 'cards',
        sortOrder: 'asc',
        selectedStatus: 'all',
        selectedBuildings: [],
        plannedFrom: '',
        plannedTo: '',
        page_size: 10,
        selectedSort: 0,
        page: 1
    };
    
    return {
        getTicketsFilters: vi.fn().mockReturnValue(mockFilters),
        setTicketsFilters: vi.fn(),
        clearTicketsFilters: vi.fn(),
        getTicketsFiltersStorage: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue(mockFilters),
            set: vi.fn(),
            clear: vi.fn()
        })
    };
});

vi.mock('$lib/utils/tickets/api/endpoints', () => ({
    TICKETS_API_ENDPOINTS: {
        list: '/api/tickets',
        read: '/api/tickets/',
        create: '/api/tickets/create',
        update: '/api/tickets/update/',
        delete: '/api/tickets/delete/',
        consts: '/api/tickets/consts',
        images: '/api/tickets/images/',
        attachments: '/api/tickets/images'
    }
}));

vi.mock('$lib/utils/setup/stores', () => ({
    order: { 
        subscribe: vi.fn(),
        set: vi.fn()
    },
    buildings: { 
        subscribe: vi.fn(),
        set: vi.fn()
    }
}));

Object.defineProperty(globalThis, 'document', {
    value: globalThis.document || {
        cookie: '',
        querySelector: vi.fn().mockReturnValue({ scrollIntoView: vi.fn() }),
        querySelectorAll: vi.fn().mockReturnValue([]),
        getElementById: vi.fn(),
        createElement: vi.fn().mockReturnValue({ 
            setAttribute: vi.fn(),
            appendChild: vi.fn()
        }),
        body: { appendChild: vi.fn() },
        location: { href: 'http://localhost:3000/' }
    },
    writable: true
});

Object.defineProperty(globalThis, 'window', {
    value: globalThis.window || {
        document: globalThis.document,
        location: { href: 'http://localhost:3000/' },
        scrollTo: vi.fn(),
        localStorage: {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn()
        },
        sessionStorage: {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn()
        }
    },
    writable: true
});

if (!globalThis.Blob) {
    globalThis.Blob = class Blob {
        size = 0;
        type = '';
        constructor(bits: any[], options?: any) {
            this.size = bits.join('').length;
            this.type = options?.type || '';
        }
        slice() { return new Blob([] as any); }
        arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); }
        text() { return Promise.resolve(''); }
        stream() { return {} as any; }
    } as any;
}

if (!globalThis.File) {
    globalThis.File = class File {
        name: string;
        size: number;
        type: string;
        content: any;
        constructor(bits: any[], name: string, options: any = {}) {
            this.name = name;
            this.size = bits.join('').length;
            this.type = options.type || '';
            this.content = bits;
        }
    } as any;
}

import setupApiMock from '../../../../apiClientMock';
import { it, expect, describe, beforeEach } from 'vitest';
import { getTicketsFilters } from '$lib/utils/tickets/stores';
const { apiMock, helpers } = setupApiMock();

const filtersValue = {
    search: '',
    viewMode: 'cards',
    sortOrder: 'asc',
    selectedStatus: 'all',
    selectedBuildings: [],
    plannedFrom: '',
    plannedTo: '',
    page_size: 10,
    selectedSort: 0,
    page: 1
};

beforeEach(() => {
    vi.resetModules();
    helpers.resetMocks();
    vi.clearAllMocks();

    (getTicketsFilters as any).mockReturnValue({ ...filtersValue });
    (globalThis as any).URL = (globalThis as any).URL || {};
    (globalThis as any).URL.createObjectURL = (globalThis as any).URL.createObjectURL || vi.fn((b) => `mocked-url-for-${b}`);
});

function mockSvelteGet(getImpl: (...args: any[]) => any) {
    vi.doMock('svelte/store', () => {
        return {
            get: getImpl,
            writable: (initial: any) => {
                const subs: Function[] = [];
                return {
                    subscribe: (fn: Function) => {
                        subs.push(fn);
                        fn(initial);
                        return () => {};
                    },
                    set: (v: any) => subs.forEach(s => s(v))
                };
            }
        };
    });
}

describe('Tickets API GET methods', () => {
    it('Fetch tickets successfully', async () => {
        helpers.mockSuccess('get', { items: [{ id: 'ticket-1' }, { id: 'ticket-2' }], max_page: 2 });

        const mod = await import('$lib/utils/tickets/api/get');
        const result = await mod.fetchTickets();

        expect(result).toEqual({ tickets: [{ id: 'ticket-1' }, { id: 'ticket-2' }], max_page: 2 });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/?page=1&page_size=10&order_by=id&sort_order=asc');
    });

    it('Fetch tickets with all parameters', async () => {
        (getTicketsFilters as any).mockReturnValue({
            ...filtersValue,
            search: 'network',
            selectedStatus: 'open',
            selectedBuildings: [1, 2],
            plannedFrom: '2023-01-01',
            plannedTo: '2023-12-31',
            sortOrder: 'desc',
            selectedSort: 1,
            page_size: 5,
            page: 3
        });

        helpers.mockSuccess('get', { items: [{ id: 'ticket-3' }, { id: 'ticket-4' }], max_page: 4 });

        const { fetchTickets } = await import('$lib/utils/tickets/api/get');
        const result = await fetchTickets();

        expect(result).toEqual({ tickets: [{ id: 'ticket-3' }, { id: 'ticket-4' }], max_page: 4 });
        expect(apiMock.get).toHaveBeenCalledWith(
            '/api/tickets/?page=1&page_size=5&order_by=plannedat&sort_order=desc&statuses[]=open&planned_from=2023-01-01T00%3A00%3A00Z&planned_to=2023-12-31T23%3A59%3A59Z&buildings[]=1&buildings[]=2&search=network'
        );
    });

    it('Handle API 500 error', async () => {
        helpers.mockError('get', '', 500);
        const { fetchTickets } = await import('$lib/utils/tickets/api/get');
        await expect(fetchTickets()).rejects.toThrow();
    
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/?page=1&page_size=10&order_by=id&sort_order=asc');
    });

    it('Handle API 404 error', async () => {
        helpers.mockError('get', 'API Error', 404);
        const { fetchTickets } = await import('$lib/utils/tickets/api/get');
        const result = await fetchTickets();
    
        expect(result).toEqual({ tickets: [], max_page: 1 });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/?page=1&page_size=10&order_by=id&sort_order=asc');
    });

    it('Uses search_params even when only page parameter is present', async () => {
        helpers.mockSuccess('get', { items: [{ id: 'page-5' }], max_page: 10 });
        const { fetchTickets } = await import('$lib/utils/tickets/api/get');
        const result = await fetchTickets('', { page: 5 });
    
        expect(result).toEqual({ tickets: [{ id: 'page-5' }], max_page: 10 });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/?page=5&page_size=10&order_by=id&sort_order=asc');
    });

    it('Uses search_params directly when provided', async () => {
        helpers.mockSuccess('get', { items: [{ id: 'custom-1' }], max_page: 1 });
        const { fetchTickets } = await import('$lib/utils/tickets/api/get');
        const result = await fetchTickets('', { custom_param: 'value', another_param: 123 });
    
        expect(result).toEqual({ tickets: [{ id: 'custom-1' }], max_page: 1 });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/?custom_param=value&another_param=123');
    });

    it('Uses default order_by=id when selectedSort maps to undefined', async () => {
        (getTicketsFilters as any).mockReturnValueOnce({ ...filtersValue, selectedSort: 999 });
        helpers.mockSuccess('get', { items: [{ id: 'default-order' }], max_page: 1 });

        const { fetchTickets } = await import('$lib/utils/tickets/api/get');
        const result = await fetchTickets();

        expect(result).toEqual({ tickets: [{ id: 'default-order' }], max_page: 1 });
        expect(apiMock.get).toHaveBeenCalledWith(expect.stringContaining('order_by=id'));
    });

    it('Uses empty array as fallback when items is missing in response', async () => {
        helpers.mockSuccess('get', { max_page: 3 });
        const { fetchTickets } = await import('$lib/utils/tickets/api/get');
        const result = await fetchTickets();

        expect(result).toEqual({ tickets: [], max_page: 3 });
    });

    it('Uses 1 as fallback when max_page is missing in response', async () => {
        helpers.mockSuccess('get', { items: [{ id: 'ticket-1' }] });
        const { fetchTickets } = await import('$lib/utils/tickets/api/get');
        const result = await fetchTickets();

        expect(result).toEqual({ tickets: [{ id: 'ticket-1' }], max_page: 1 });
    });
});

describe('Get ticket by ID', () => {
    it('Fetch ticket successfully', async () => {
        const ticketId = 'ticket-123';
        helpers.mockSuccess('get', { id: ticketId, title: 'Test Ticket' });
        const { getById } = await import('$lib/utils/tickets/api/get');
        const result = await getById(ticketId);

        expect(result).toEqual({ id: ticketId, title: 'Test Ticket' });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/ticket-123');
    });

    it('Handle API error', async () => {
        const ticketId = 'ticket-error';
        helpers.mockError('get', 'API Error', 500);

        const { getById } = await import('$lib/utils/tickets/api/get');
        await expect(getById(ticketId)).rejects.toThrow('API Error');

        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/ticket-error');
    });

    it('Handle unknown error', async () => {
        const ticketId = 'ticket-unknown';
        helpers.mockError('get', '', 0);

        const { getById } = await import('$lib/utils/tickets/api/get');
        await expect(getById(ticketId)).rejects.toThrow('Ошибка получения заявки');

        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/ticket-unknown');
    });
});

describe('Fetch consts', () => {
    it('Fetch consts successfully', async () => {
        mockSvelteGet(() => []);
        helpers.mockSuccess('get', { order_by: ['test1', 'test2'], buildings: [1, 2, 3] });

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        const result = await fetchConsts();

        expect(result).toEqual({ order: ['test1', 'test2'], buildings: [1, 2, 3] });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');
    });

    it('Fetch void consts', async () => {
        mockSvelteGet(() => []);
        helpers.mockSuccess('get', {});

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        const result = await fetchConsts();

        expect(result).toEqual({ order: [], buildings: [] });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');
    });

    it('Returns values from stores when both are not empty', async () => {
        const modStores = await import('$lib/utils/setup/stores');
        mockSvelteGet((store: any) => {
            if (store === (modStores as any).order) return ['id', 'created_at'];
            if (store === (modStores as any).buildings) return [1, 2, 3];
            return undefined;
        });

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        const result = await fetchConsts();

        expect(result).toEqual({ order: ['id', 'created_at'], buildings: [1, 2, 3] });
        expect(apiMock.get).not.toHaveBeenCalled();
    });

    it('Calls API when buildings store is empty', async () => {
        const modStores = await import('$lib/utils/setup/stores');
        mockSvelteGet((store: any) => {
            if (store === (modStores as any).order) return ['id'];
            if (store === (modStores as any).buildings) return [];
            return undefined;
        });
        helpers.mockSuccess('get', { order_by: ['id', 'name'], buildings: [4, 5, 6] });

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        const result = await fetchConsts();

        expect(result).toEqual({ order: ['id', 'name'], buildings: [4, 5, 6] });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');

        const modStoresAfter = await import('$lib/utils/setup/stores');
        expect((modStoresAfter as any).order.set).toHaveBeenCalledWith(['id', 'name']);
        expect((modStoresAfter as any).buildings.set).toHaveBeenCalledWith([4, 5, 6]);
    });

    it('Calls API when order store is empty', async () => {
        const modStores = await import('$lib/utils/setup/stores');
        mockSvelteGet((store: any) => {
            if (store === (modStores as any).order) return [];
            if (store === (modStores as any).buildings) return [1, 2];
            return undefined;
        });
        helpers.mockSuccess('get', { order_by: ['title', 'date'], buildings: [7, 8] });

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        const result = await fetchConsts();

        expect(result).toEqual({ order: ['title', 'date'], buildings: [7, 8] });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');

        const modStoresAfter = await import('$lib/utils/setup/stores');
        expect((modStoresAfter as any).order.set).toHaveBeenCalledWith(['title', 'date']);
        expect((modStoresAfter as any).buildings.set).toHaveBeenCalledWith([7, 8]);
    });

    it('Handle API error', async () => {
        mockSvelteGet(() => []);
        helpers.mockError('get', 'API Error', 500);

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        await expect(fetchConsts()).rejects.toThrow('API Error');

        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');
    });

    it('Handle unknown error', async () => {
        mockSvelteGet(() => []);
        helpers.mockError('get', '', 500);

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        await expect(fetchConsts()).rejects.toThrow('Ошибка загрузки констант');

        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');
    });
});

describe('Fetch ticket images', () => {
    it('Fetch images successfully', async () => {
        const capturedUrls: string[] = [];

        vi.mocked(apiMock.get).mockImplementation((url: string) => {
            capturedUrls.push(url);
            const blob = new Blob(['img'], { type: 'image/png' });
            return Promise.resolve({ success: true, data: blob, status: 200 });
        });

        const { fetchImages } = await import('$lib/utils/tickets/api/get');
        const attachments = ['attachment-1', 'attachment-2'];
        const result = await fetchImages(attachments);

        expect(capturedUrls[0]).toContain('attachment-1');
        expect(capturedUrls[1]).toContain('attachment-2');
        expect(result.length).toBe(2);
        expect(result[0]).toMatch(/mocked-url-for-/);
        expect(result[1]).toMatch(/mocked-url-for-/);
    });

    it('Handles failed image requests gracefully', async () => {
        let callCount = 0;
        vi.mocked(apiMock.get).mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                const blob = new Blob(['success'], { type: 'image/png' });
                return Promise.resolve({ success: true, data: blob, status: 200 });
            } else {
                return Promise.resolve({ success: false, error: 'Not found', status: 404 });
            }
        });
        const { fetchImages } = await import('$lib/utils/tickets/api/get');
        const attachments = ['success-attachment', 'fail-attachment'];
        const result = await fetchImages(attachments);

        expect(result.length).toBe(1);
        expect(result[0]).toMatch(/mocked-url-for-/);
    });

    it('Returns empty array for empty attachments', async () => {
        const { fetchImages } = await import('$lib/utils/tickets/api/get');
        const result = await fetchImages([]);

        expect(result).toEqual([]);
        expect(apiMock.get).not.toHaveBeenCalled();
    });
});

describe('Load active user tickets', () => {
    it('Catch API errors', async () => {
        helpers.mockError('get', 'API Error', 500);
        const { loadActiveUserTickets } = await import('$lib/utils/tickets/api/get');
        const result = await loadActiveUserTickets('test-id');

        expect(result).toEqual([]);
    });

    it('Catch userId is falsy', async () => {
        const mod = await import('$lib/utils/tickets/api/get');
        const spy = vi.spyOn(mod, 'fetchTickets');
        const result = await mod.loadActiveUserTickets('');

        expect(result).toEqual([]);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('Returns tickets successfully', async () => {
        const tickets = [{ id: 't1' }, { id: 't2' }];
        helpers.mockSuccess('get', { items: tickets, max_page: 1 });
        const { loadActiveUserTickets } = await import('$lib/utils/tickets/api/get');
        const result = await loadActiveUserTickets('user-123');

        expect(result).toEqual(tickets);
        expect(apiMock.get).toHaveBeenCalled();

        const calledUrl = (apiMock.get as any).mock.calls[0][0] as string;
        expect(calledUrl).toContain('assigned_to=user-123');
        expect(calledUrl).toContain('page_size=3');
    });

    it('Returns tickets successfully', async () => {
        const tickets = [{ id: 't1' }, { id: 't2' }];
        helpers.mockSuccess('get', { items: tickets, max_page: 1 });
        const { loadActiveUserTickets } = await import('$lib/utils/tickets/api/get');
        const result = await loadActiveUserTickets('user-123');

        expect(result).toEqual(tickets);
        expect(apiMock.get).toHaveBeenCalled();

        const calledUrl = (apiMock.get as any).mock.calls[0][0] as string;
        expect(calledUrl).toContain('assigned_to=user-123');
        expect(calledUrl).toContain('page_size=3');
    }); 
});