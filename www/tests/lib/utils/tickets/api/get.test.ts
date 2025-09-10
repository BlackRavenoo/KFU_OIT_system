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
        images: '/api/tickets/images/'
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

vi.mock('svelte/store', () => {
    return {
        get: vi.fn((store) => {
            if (store === order) return ['id'];
            if (store === buildings) return [1, 2];
            return undefined;
        })
    };
});

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

Object.defineProperty(globalThis, 'document', {
    value: {
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
    value: {
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
        size: number = 0;
        type: string = '';
        
        constructor(bits: BlobPart[], options?: BlobPropertyBag) {
            this.size = bits.join('').length;
            this.type = options?.type || '';
        }
        
        slice() {
            return new Blob([]);
        }
        
        arrayBuffer() {
            return Promise.resolve(new ArrayBuffer(0));
        }
        
        text() {
            return Promise.resolve('');
        }
        
        stream() {
            return {} as any;
        }
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
import { fetchTickets, getById, fetchConsts, fetchImages } from '$lib/utils/tickets/api/get';
import { getTicketsFilters } from '$lib/utils/tickets/stores';
import { get } from 'svelte/store';
import { order, buildings } from '$lib/utils/setup/stores';

const { apiMock, helpers } = setupApiMock();

describe('Tickets API GET methods', () => {
    beforeEach(() => {
        helpers.resetMocks();
        vi.clearAllMocks();
        
        (getTicketsFilters as any).mockReturnValue({...filtersValue});
    });
    
    it('Fetch tickets successfully', async () => {
        helpers.mockSuccess('get', {
            items: [{ id: 'ticket-1' }, { id: 'ticket-2' }],
            max_page: 2
        });

        const result = await fetchTickets();

        expect(result).toEqual({
            tickets: [{ id: 'ticket-1' }, { id: 'ticket-2' }],
            max_page: 2
        });
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

        helpers.mockSuccess('get', {
            items: [{ id: 'ticket-3' }, { id: 'ticket-4' }],
            max_page: 4
        });

        const result = await fetchTickets();

        expect(result).toEqual({
            tickets: [{ id: 'ticket-3' }, { id: 'ticket-4' }],
            max_page: 4
        });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/?page=1&page_size=5&order_by=plannedat&sort_order=desc&statuses[]=open&planned_from=2023-01-01T00%3A00%3A00Z&planned_to=2023-12-31T23%3A59%3A59Z&buildings[]=1&buildings[]=2&search=network');
    });

    it('Handle API 500 error', async () => {
        helpers.mockError('get', '', 500);
        await expect(fetchTickets()).rejects.toThrow();
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/?page=1&page_size=10&order_by=id&sort_order=asc');
    });

    it('Handle API 404 error', async () => {
        helpers.mockError('get', 'API Error', 404);
        const result = await fetchTickets();
        expect(result).toEqual({
            tickets: [],
            max_page: 1
        });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/?page=1&page_size=10&order_by=id&sort_order=asc');
    });

    it('Uses search_params even when only page parameter is present', async () => {
        const pageOnlyParams = {
            page: 5
        };

        helpers.mockSuccess('get', {
            items: [{ id: 'page-5' }],
            max_page: 10
        });

        const result = await fetchTickets('', pageOnlyParams);

        expect(result).toEqual({
            tickets: [{ id: 'page-5' }],
            max_page: 10
        });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/?page=5&page_size=10&order_by=id&sort_order=asc');
    });

    it('Uses search_params directly when provided (else branch)', async () => {
        const customParams = {
            custom_param: 'value',
            another_param: 123
        };

        helpers.mockSuccess('get', {
            items: [{ id: 'custom-1' }],
            max_page: 1
        });

        const result = await fetchTickets('', customParams);

        expect(result).toEqual({
            tickets: [{ id: 'custom-1' }],
            max_page: 1
        });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/?custom_param=value&another_param=123');
    });

    it('Uses default order_by=id when selectedSort maps to undefined', async () => {
        (getTicketsFilters as any).mockReturnValueOnce({
            ...filtersValue,
            selectedSort: 999
        });

        helpers.mockSuccess('get', {
            items: [{ id: 'default-order' }],
            max_page: 1
        });

        const result = await fetchTickets();

        expect(result).toEqual({
            tickets: [{ id: 'default-order' }],
            max_page: 1
        });
        expect(apiMock.get).toHaveBeenCalledWith(expect.stringContaining('order_by=id'));
    });

    it('Uses empty array as fallback when items is missing in response', async () => {
        helpers.mockSuccess('get', {
            max_page: 3
        });

        const result = await fetchTickets();

        expect(result).toEqual({
            tickets: [],
            max_page: 3
        });
    });

    it('Uses 1 as fallback when max_page is missing in response', async () => {
        helpers.mockSuccess('get', {
            items: [{ id: 'ticket-1' }]
        });

        const result = await fetchTickets();

        expect(result).toEqual({
            tickets: [{ id: 'ticket-1' }],
            max_page: 1
        });
    });
});

describe('Get ticket by ID', () => {
    it('Fetch ticket successfully', async () => {
        const ticketId = 'ticket-123';
        helpers.mockSuccess('get', { id: ticketId, title: 'Test Ticket' });

        const result = await getById(ticketId);

        expect(result).toEqual({ id: ticketId, title: 'Test Ticket' });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/ticket-123');
    });

    it('Handle API error', async () => {
        const ticketId = 'ticket-error';
        helpers.mockError('get', 'API Error', 500);
        
        await expect(getById(ticketId)).rejects.toThrow('API Error');
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/ticket-error');
    });

    it('Handle unknown error', async () => {
        const ticketId = 'ticket-unknown';
        helpers.mockError('get', '', 0);

        await expect(getById(ticketId)).rejects.toThrow('Ошибка получения заявки');
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/ticket-unknown');
    });
});

describe('Fetch consts', () => {
    beforeEach(() => {
        helpers.resetMocks();
        vi.clearAllMocks();
    });
    
    it('Fetch consts successfully', async () => {
        (get as any).mockImplementation(() => []);
        
        helpers.mockSuccess('get', { order_by: ['test1', 'test2'], buildings: [1, 2, 3] });

        const result = await fetchConsts();

        expect(result).toEqual({ order: ['test1', 'test2'], buildings: [1, 2, 3] });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');
    });

    it('Fetch void consts', async () => {
        (get as any).mockImplementation(() => []);
        
        helpers.mockSuccess('get', { });

        const result = await fetchConsts();

        expect(result).toEqual({ order: [], buildings: [] });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');
    });
    
    it('Returns values from stores when both are not empty', async () => {
        // @ts-ignore
        (get as any).mockImplementation((store) => {
            if (store === order) return ['id', 'created_at'];
            if (store === buildings) return [1, 2, 3];
            return undefined;
        });
        
        const result = await fetchConsts();
        
        expect(result).toEqual({
            order: ['id', 'created_at'],
            buildings: [1, 2, 3]
        });
        expect(apiMock.get).not.toHaveBeenCalled();
    });
    
    it('Calls API when buildings store is empty', async () => {
        // @ts-ignore
        (get as any).mockImplementation((store) => {
            if (store === order) return ['id'];
            if (store === buildings) return [];
            return undefined;
        });
        
        helpers.mockSuccess('get', { 
            order_by: ['id', 'name'], 
            buildings: [4, 5, 6]
        });
        
        const result = await fetchConsts();
        
        expect(result).toEqual({
            order: ['id', 'name'],
            buildings: [4, 5, 6]
        });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');
        expect(order.set).toHaveBeenCalledWith(['id', 'name']);
        expect(buildings.set).toHaveBeenCalledWith([4, 5, 6]);
    });
    
    it('Calls API when order store is empty', async () => {
        // @ts-ignore
        (get as any).mockImplementation((store) => {
            if (store === order) return [];
            if (store === buildings) return [1, 2];
            return undefined;
        });
        
        helpers.mockSuccess('get', { 
            order_by: ['title', 'date'], 
            buildings: [7, 8]
        });
        
        const result = await fetchConsts();
        
        expect(result).toEqual({
            order: ['title', 'date'],
            buildings: [7, 8]
        });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');
        expect(order.set).toHaveBeenCalledWith(['title', 'date']);
        expect(buildings.set).toHaveBeenCalledWith([7, 8]);
    });

    it('Handle API error', async () => {
        (get as any).mockImplementation(() => []);
        
        helpers.mockError('get', 'API Error', 500);
        
        await expect(fetchConsts()).rejects.toThrow('API Error');
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');
    });

    it('Handle unknown error', async () => {
        (get as any).mockImplementation(() => []);

        helpers.mockError('get', '', 500);

        await expect(fetchConsts()).rejects.toThrow('Ошибка загрузки констант');
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');
    });
});