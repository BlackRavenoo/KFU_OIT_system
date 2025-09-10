import { vi } from 'vitest';

const apiMock = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
};

vi.mock('$lib/utils/api', () => {
    return {
        api: apiMock
    };
});

vi.mock('axios', () => {
    const axiosMock = {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        request: vi.fn(),
        create: vi.fn().mockReturnValue({
            defaults: {
                baseURL: '',
                headers: {}
            },
            interceptors: {
                request: {
                    use: vi.fn(),
                    eject: vi.fn(),
                },
                response: {
                    use: vi.fn(),
                    eject: vi.fn(),
                }
            },
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn(),
            request: vi.fn()
        }),
        defaults: {
            headers: {
                common: {}
            }
        },
        interceptors: {
            request: {
                use: vi.fn(),
                eject: vi.fn(),
            },
            response: {
                use: vi.fn(),
                eject: vi.fn(),
            }
        }
    };
    
    return { default: axiosMock };
});

/**
 * Настраивает перехват сетевых запросов в тестах
 */
export function setupApiMock() {
    globalThis.document = globalThis.document || {
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
    } as any;

    globalThis.window = globalThis.window || {
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
    } as any;

    Object.values(apiMock).forEach(method => {
        method.mockResolvedValue({
            success: true,
            data: {},
            status: 200
        });
    });

    const helpers = {
        mockSuccess: (method: keyof typeof apiMock, data = {}) => {
            apiMock[method].mockResolvedValueOnce({
                success: true,
                data,
                status: 200
            });
        },
        
        mockError: (method: keyof typeof apiMock, error = 'Ошибка запроса', status = 400) => {
            apiMock[method].mockResolvedValueOnce({
                success: false,
                error,
                status
            });
        },
        
        resetMocks: () => {
            vi.resetAllMocks();
            
            Object.values(apiMock).forEach(method => {
                method.mockResolvedValue({
                    success: true,
                    data: {},
                    status: 200
                });
            });
        }
    };

    return { apiMock, helpers };
}

export default setupApiMock;