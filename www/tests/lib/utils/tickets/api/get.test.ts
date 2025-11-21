import { vi } from 'vitest';

let svelteGetImpl: ((store?: any) => any) | null = null;

vi.mock('svelte/store', () => {
    const arrayProxyHandler: ProxyHandler<any[]> = {
        get(target, prop, receiver) {
            if (typeof prop === 'string' && /^[0-9]+$/.test(prop)) {
                const idx = Number(prop);
                if (idx in target) return Reflect.get(target, prop, receiver);
                return {};
            }
            return Reflect.get(target, prop, receiver);
        }
    };

    return {
        get: (store?: any) => {
            try {
                if (svelteGetImpl) {
                    const res = svelteGetImpl(store);
                    if (Array.isArray(res)) return new Proxy(res, arrayProxyHandler);
                    return res;
                }
                if (store && typeof store.__get === 'function') {
                    const res = store.__get();
                    if (Array.isArray(res)) return new Proxy(res, arrayProxyHandler);
                    return res;
                }
            } catch { }
            return [];
        },
        writable: (initial: any) => {
            const subs: Function[] = [];
            let value = initial;
            return {
                subscribe: (fn: Function) => {
                    try { fn(value); } catch {}
                    subs.push(fn);
                    return () => {};
                },
                set: (v: any) => {
                    value = v;
                    subs.forEach(s => s(v));
                }
            };
        }
    };
});

function mockSvelteGet(fn: (...args: any[]) => any) {
    svelteGetImpl = fn;
}

vi.mock('$lib/utils/tickets/stores', () => {
    const mockFilters = {
        search: '',
        viewMode: 'cards',
        sortOrder: 'asc',
        selectedStatus: 'all',
        selectedBuildings: [],
        selectedDepartment: 'all',
        department: undefined,
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

vi.mock('$lib/utils/setup/stores', () => {
    function makeStore(initial: any) {
        let value = initial;
        return {
            subscribe: (run: (v: any) => void) => {
                try { run(value); } catch {}
                return () => {};
            },
            set: vi.fn((v: any) => { value = v; }),
            __get: () => value
        };
    }

    const order = makeStore([{ id: 0 }]);
    const buildings = makeStore([]);
    const departments = makeStore([]);

    return { order, buildings, departments };
});

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

const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
};

Object.defineProperty(globalThis, 'window', {
    value: globalThis.window || {
        document: globalThis.document,
        location: { href: 'http://localhost:3000/' },
        scrollTo: vi.fn(),
        localStorage: localStorageMock,
        sessionStorage: {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn()
        }
    },
    writable: true
});

Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
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
    selectedDepartment: 'all',
    department: undefined,
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

    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();

    svelteGetImpl = null;

    (getTicketsFilters as any).mockReturnValue({ ...filtersValue });
    (globalThis as any).URL = (globalThis as any).URL || {};
    (globalThis as any).URL.createObjectURL = (globalThis as any).URL.createObjectURL || vi.fn((b) => `mocked-url-for-${b}`);
});

describe('Tickets API GET methods', () => {
    it('Fetch tickets successfully', async () => {
        helpers.mockSuccess('get', { items: [{ id: 'ticket-1' }, { id: 'ticket-2' }], max_page: 2 });

        const mod = await import('$lib/utils/tickets/api/get');
        const result = await mod.fetchTickets();

        expect(result).toEqual({ tickets: [{ id: 'ticket-1' }, { id: 'ticket-2' }], max_page: 2 });

        const calledUrl = (apiMock.get as any).mock.calls[0][0] as string;
        expect(calledUrl).toContain('/api/tickets/?');
        expect(calledUrl).toContain('page=1');
        expect(calledUrl).toContain('page_size=10');
        expect(calledUrl).toContain('sort_order=asc');
        expect(calledUrl).toContain('statuses[]=');
    });

    it('Fetch tickets with all parameters', async () => {
        (getTicketsFilters as any).mockReturnValue({
            ...filtersValue,
            search: 'network',
            selectedStatus: 'open',
            selectedBuildings: [1, 2],
            department: '3',
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

        const calledUrl = (apiMock.get as any).mock.calls[0][0] as string;
        expect(calledUrl).toContain('/api/tickets/?');
        expect(calledUrl).toContain('search=network');
        expect(calledUrl).toContain('planned_from=');
        expect(calledUrl).toContain('planned_to=');
        expect(calledUrl).toContain('buildings[]=');
    });

    it('Handle API 500 error', async () => {
        helpers.mockError('get', '', 500);
        const { fetchTickets } = await import('$lib/utils/tickets/api/get');
        await expect(fetchTickets()).rejects.toThrow();

        const calledUrl = (apiMock.get as any).mock.calls[0][0] as string;
        expect(calledUrl).toContain('/api/tickets/?');
    });

    it('Handle API 404 error', async () => {
        helpers.mockError('get', 'API Error', 404);
        const { fetchTickets } = await import('$lib/utils/tickets/api/get');
        const result = await fetchTickets();

        expect(result).toEqual({ tickets: [], max_page: 1 });
        const calledUrl = (apiMock.get as any).mock.calls[0][0] as string;
        expect(calledUrl).toContain('/api/tickets/?');
    });

    it('Uses search_params even when only page parameter is present', async () => {
        helpers.mockSuccess('get', { items: [{ id: 'page-5' }], max_page: 10 });
        const { fetchTickets } = await import('$lib/utils/tickets/api/get');
        const result = await fetchTickets('', { page: 5 });

        expect(result).toEqual({ tickets: [{ id: 'page-5' }], max_page: 10 });
        const calledUrl = (apiMock.get as any).mock.calls[0][0] as string;
        expect(calledUrl).toContain('page=5');
    });

    it('Uses search_params directly when provided', async () => {
        helpers.mockSuccess('get', { items: [{ id: 'custom-1' }], max_page: 1 });
        const { fetchTickets } = await import('$lib/utils/tickets/api/get');
        const result = await fetchTickets('', { custom_param: 'value', another_param: 123 });

        expect(result).toEqual({ tickets: [{ id: 'custom-1' }], max_page: 1 });
        const calledUrl = (apiMock.get as any).mock.calls[0][0] as string;
        expect(calledUrl).toContain('custom_param=value');
        expect(calledUrl).toContain('another_param=123');
    });

    it('Uses default order_by when selectedSort maps to undefined', async () => {
        mockSvelteGet((store: any) => {
            return [];
        });
        (getTicketsFilters as any).mockReturnValueOnce({ ...filtersValue, selectedSort: 999 });
        helpers.mockSuccess('get', { items: [{ id: 'default-order' }], max_page: 1 });

        const { fetchTickets } = await import('$lib/utils/tickets/api/get');
        const result = await fetchTickets();

        expect(result).toEqual({ tickets: [{ id: 'default-order' }], max_page: 1 });
        const calledUrl = (apiMock.get as any).mock.calls[0][0] as string;
        expect(calledUrl).toContain('order_by=');
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

    it('Normalizes invalid array-like params to empty (but string departments will be used as single value)', async () => {
        helpers.mockSuccess('get', { items: [], max_page: 1 });

        const { fetchTickets } = await import('$lib/utils/tickets/api/get');
        await fetchTickets('', {
            custom_param: 'value',
            statuses: 123 as any,
            buildings: { bad: true } as any,
            departments: 'not-array' as any
        });

        const calledUrl = (apiMock.get as any).mock.calls[0][0] as string;
        expect(calledUrl).toContain('custom_param=value');
        expect(calledUrl).not.toContain('statuses');
        expect(calledUrl).not.toContain('buildings');
        expect(calledUrl).toContain('departments[]=');
    });

    it('Applies default statuses when selectedStatus is empty', async () => {
        (getTicketsFilters as any).mockReturnValueOnce({ ...filtersValue, selectedStatus: [] });
        helpers.mockSuccess('get', { items: [], max_page: 1 });

        const { fetchTickets } = await import('$lib/utils/tickets/api/get');
        await fetchTickets();

        const calledUrl = (apiMock.get as any).mock.calls[0][0] as string;
        expect(calledUrl).toContain('statuses[]=open');
        expect(calledUrl).toContain('statuses[]=closed');
        expect(calledUrl).toContain('statuses[]=inprogress');
        expect(calledUrl).toContain('statuses[]=cancelled');
    });

    it('Calls get(departments) inside fetchTickets when filters.department === -1', async () => {
        (getTicketsFilters as any).mockReturnValueOnce({ ...filtersValue, department: -1 });

        const modStores = await import('$lib/utils/setup/stores');
        const spy = vi.fn((store: any) => {
            if (store === (modStores as any).departments) return [{ id: 42, name: 'IT' }];
            return [];
        });
        mockSvelteGet(spy);
        helpers.mockSuccess('get', { items: [], max_page: 1 });

        const { fetchTickets } = await import('$lib/utils/tickets/api/get');
        await fetchTickets();

        expect(spy).toHaveBeenCalled();
        const calledWithDepartments = spy.mock.calls.some(call => call[0] === (modStores as any).departments);
        expect(calledWithDepartments).toBe(true);
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

describe('Fetch consts with caching', () => {
    it('Fetch consts successfully from API when no cache', async () => {
        mockSvelteGet(() => []);
        localStorageMock.getItem.mockReturnValue(null);
        helpers.mockSuccess('get', { order_by: ['test1', 'test2'], buildings: [1, 2, 3], departments: [{ id: 1, name: 'IT' }] });

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        const result = await fetchConsts();

        expect(result).toEqual({ order: ['test1', 'test2'], buildings: [1, 2, 3], departments: [{ id: 1, name: 'IT' }] });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'tickets_consts_cache',
            expect.stringContaining('"data":{"buildings":[1,2,3],"order":["test1","test2"],"departments":[{"id":1,"name":"IT"}]}')
        );
    });

    it('Uses cached data when available and not expired', async () => {
        const cachedData = {
            timestamp: Date.now() - 5 * 60 * 1000,
            data: { buildings: [4, 5], order: ['cached1', 'cached2'], departments: [{ id: 2, name: 'HR' }] }
        };
        localStorageMock.getItem.mockReturnValue(JSON.stringify(cachedData));

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        const result = await fetchConsts();

        expect(result).toEqual({ buildings: [4, 5], order: ['cached1', 'cached2'], departments: [{ id: 2, name: 'HR' }] });
        expect(apiMock.get).not.toHaveBeenCalled();
    });

    it('Fetches fresh data when cache is expired', async () => {
        const expiredCachedData = {
            timestamp: Date.now() - 20 * 60 * 1000,
            data: { buildings: [4, 5], order: ['old1', 'old2'], departments: [] }
        };
        localStorageMock.getItem.mockReturnValue(JSON.stringify(expiredCachedData));
        mockSvelteGet(() => []);
        helpers.mockSuccess('get', { order_by: ['fresh1', 'fresh2'], buildings: [6, 7, 8], departments: [{ id: 3, name: 'Finance' }] });

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        const result = await fetchConsts();

        expect(result).toEqual({ order: ['fresh1', 'fresh2'], buildings: [6, 7, 8], departments: [{ id: 3, name: 'Finance' }] });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');
    });

    it('Handles corrupted cache gracefully', async () => {
        localStorageMock.getItem.mockReturnValue('invalid-json');
        mockSvelteGet(() => []);
        helpers.mockSuccess('get', { order_by: ['recovered1'], buildings: [9], departments: [] });

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        const result = await fetchConsts();

        expect(result).toEqual({ order: ['recovered1'], buildings: [9], departments: [] });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');
    });

    it('Returns values from stores when both are not empty and saves to cache', async () => {
        const modStores = await import('$lib/utils/setup/stores');
        mockSvelteGet((store: any) => {
            if (store === (modStores as any).order) return ['id', 'created_at'];
            if (store === (modStores as any).buildings) return [1, 2, 3];
            if (store === (modStores as any).departments) return [{ id: 1, name: 'IT' }];
            return [];
        });
        localStorageMock.getItem.mockReturnValue(null);

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        const result = await fetchConsts();

        expect(result).toEqual({ order: ['id', 'created_at'], buildings: [1, 2, 3], departments: [{ id: 1, name: 'IT' }] });
        expect(apiMock.get).not.toHaveBeenCalled();
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'tickets_consts_cache',
            expect.stringContaining('"data":{"buildings":[1,2,3],"order":["id","created_at"],"departments":[{"id":1,"name":"IT"}]}')
        );
    });

    it('Calls API when buildings store is empty', async () => {
        const modStores = await import('$lib/utils/setup/stores');
        mockSvelteGet((store: any) => {
            if (store === (modStores as any).order) return ['id'];
            if (store === (modStores as any).buildings) return [];
            if (store === (modStores as any).departments) return [];
            return [];
        });
        localStorageMock.getItem.mockReturnValue(null);
        helpers.mockSuccess('get', { order_by: ['id', 'name'], buildings: [4, 5, 6], departments: [{ id: 2, name: 'Sales' }] });

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        const result = await fetchConsts();

        expect(result).toEqual({ order: ['id', 'name'], buildings: [4, 5, 6], departments: [{ id: 2, name: 'Sales' }] });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');

        const modStoresAfter = await import('$lib/utils/setup/stores');
        expect((modStoresAfter as any).order.set).toHaveBeenCalledWith(['id', 'name']);
        expect((modStoresAfter as any).buildings.set).toHaveBeenCalledWith([4, 5, 6]);
        expect((modStoresAfter as any).departments.set).toHaveBeenCalledWith([{ id: 2, name: 'Sales' }]);
    });

    it('Calls API when order store is empty', async () => {
        const modStores = await import('$lib/utils/setup/stores');
        mockSvelteGet((store: any) => {
            if (store === (modStores as any).order) return [];
            if (store === (modStores as any).buildings) return [1, 2];
            if (store === (modStores as any).departments) return [];
            return [];
        });
        localStorageMock.getItem.mockReturnValue(null);
        helpers.mockSuccess('get', { order_by: ['title', 'date'], buildings: [7, 8], departments: [] });

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        const result = await fetchConsts();

        expect(result).toEqual({ order: ['title', 'date'], buildings: [7, 8], departments: [] });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');

        const modStoresAfter = await import('$lib/utils/setup/stores');
        expect((modStoresAfter as any).order.set).toHaveBeenCalledWith(['title', 'date']);
        expect((modStoresAfter as any).buildings.set).toHaveBeenCalledWith([7, 8]);
        expect((modStoresAfter as any).departments.set).toHaveBeenCalledWith([]);
    });

    it('Fetch void consts', async () => {
        mockSvelteGet(() => []);
        localStorageMock.getItem.mockReturnValue(null);
        helpers.mockSuccess('get', {});

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        const result = await fetchConsts();

        expect(result).toEqual({ order: [], buildings: [], departments: [] });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');
    });

    it('Handle API error', async () => {
        mockSvelteGet(() => []);
        localStorageMock.getItem.mockReturnValue(null);
        helpers.mockError('get', 'API Error', 500);

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        await expect(fetchConsts()).rejects.toThrow('API Error');

        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');
    });

    it('Handle unknown error', async () => {
        mockSvelteGet(() => []);
        localStorageMock.getItem.mockReturnValue(null);
        helpers.mockError('get', '', 500);

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        await expect(fetchConsts()).rejects.toThrow('Ошибка загрузки констант');

        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');
    });

    it('Handles localStorage setItem errors gracefully', async () => {
        mockSvelteGet(() => []);
        localStorageMock.getItem.mockReturnValue(null);
        localStorageMock.setItem.mockImplementation(() => {
            throw new Error('LocalStorage is full');
        });
        helpers.mockSuccess('get', { order_by: ['test1'], buildings: [1], departments: [] });

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        const result = await fetchConsts();

        expect(result).toEqual({ order: ['test1'], buildings: [1], departments: [] });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');
    });

    it('Handles localStorage setItem errors after successful API call', async () => {
        mockSvelteGet(() => []);
        localStorageMock.getItem.mockReturnValue(null);
        localStorageMock.setItem.mockImplementation(() => {
            throw new Error('Storage error');
        });
        helpers.mockSuccess('get', { order_by: ['test1'], buildings: [1], departments: [] });

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        const result = await fetchConsts();

        expect(result).toEqual({ order: ['test1'], buildings: [1], departments: [] });
        expect(apiMock.get).toHaveBeenCalledWith('/api/tickets/consts');
        expect(consoleWarnSpy).toHaveBeenCalledWith('Не удалось сохранить константы в кеш');
        expect(localStorageMock.setItem).toHaveBeenCalled();

        consoleWarnSpy.mockRestore();
    });

    it('Uses fallback empty array when buildings is not array in cache', async () => {
        const modStores = await import('$lib/utils/setup/stores');
        const invalidCacheData = {
            timestamp: Date.now() - 5 * 60 * 1000,
            data: {
                buildings: "not-an-array",
                order: ['valid1', 'valid2'],
                departments: []
            }
        };
        localStorageMock.getItem.mockReturnValue(JSON.stringify(invalidCacheData));

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        const result = await fetchConsts();

        expect((modStores as any).buildings.set).toHaveBeenCalledWith([]);
        expect((modStores as any).order.set).toHaveBeenCalledWith(['valid1', 'valid2']);
        expect((modStores as any).departments.set).toHaveBeenCalledWith([]);
        expect(result).toEqual({ buildings: "not-an-array", order: ['valid1', 'valid2'], departments: [] });
        expect(apiMock.get).not.toHaveBeenCalled();
    });

    it('Uses fallback empty array when order is not array in cache', async () => {
        const modStores = await import('$lib/utils/setup/stores');
        const invalidCacheData = {
            timestamp: Date.now() - 5 * 60 * 1000,
            data: {
                buildings: [1, 2, 3],
                order: null,
                departments: []
            }
        };
        localStorageMock.getItem.mockReturnValue(JSON.stringify(invalidCacheData));

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        const result = await fetchConsts();

        expect((modStores as any).buildings.set).toHaveBeenCalledWith([1, 2, 3]);
        expect((modStores as any).order.set).toHaveBeenCalledWith([]);
        expect((modStores as any).departments.set).toHaveBeenCalledWith([]);
        expect(result).toEqual({ buildings: [1, 2, 3], order: null, departments: [] });
        expect(apiMock.get).not.toHaveBeenCalled();
    });

    it('Sets departments store to [] when cached departments is not an array', async () => {
        const modStores = await import('$lib/utils/setup/stores');
        const invalidCache = {
            timestamp: Date.now() - 5 * 60 * 1000,
            data: { buildings: [1], order: ['o'], departments: 'not-array' }
        };
        localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(invalidCache));

        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        const result = await fetchConsts();

        expect((modStores as any).departments.set).toHaveBeenCalledWith([]);
        expect(result.departments).toBe('not-array');
    });

    it('Logs warning when localStorage throws', async () => {
        localStorageMock.getItem.mockReturnValueOnce(null);

        const modStores = await import('$lib/utils/setup/stores');

        mockSvelteGet((store: any) => {
            if (store === (modStores as any).order) return ['o1'];
            if (store === (modStores as any).buildings) return [1];
            if (store === (modStores as any).departments) return [{ id: 1, name: 'IT' }];
            return [];
        });

        localStorageMock.setItem.mockImplementationOnce(() => {
            const e = new Error('Storage error');
            (e as any).name = 'SecurityError';
            throw e;
        });

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { fetchConsts } = await import('$lib/utils/tickets/api/get');
        const result = await fetchConsts();

        expect(result).toEqual({
            buildings: [1],
            order: ['o1'],
            departments: [{ id: 1, name: 'IT' }]
        });
        expect(consoleWarnSpy).toHaveBeenCalledWith('Не удалось сохранить константы в кеш');

        consoleWarnSpy.mockRestore();
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
});