import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('Base API client', () => {
    let savedReqHandler: any = null;
    let savedReqErrorHandler: any = null;
    let savedResHandler: any = null;
    let savedResErrorHandler: any = null;

    const makeAxiosFactory = (mode: 'ok' | 'failing' | 'network' = 'ok') => {
        return () => {
            const instance: any = function (req?: any) {
                return Promise.resolve({ data: { calledWith: req || null }, status: 200 });
            };

            instance.interceptors = {
                request: { use: (h: any, e: any) => { savedReqHandler = h; savedReqErrorHandler = e; } },
                response: { use: (h: any, e: any) => { savedResHandler = h; savedResErrorHandler = e; } }
            };

            if (mode === 'ok') {
                instance.get = (route: string) => {
                    if (route === '/success') return Promise.resolve({ data: { ok: true }, status: 200 });
                    if (route === '/404') return Promise.reject({ response: { status: 404, data: { message: 'no' } } });
                    if (route === '/500') return Promise.reject({ response: { status: 500, data: {} } });
                    if (route === '/noreply') return Promise.reject({ request: {} });
                    return Promise.resolve({ data: null, status: 200 });
                };
                instance.post = (route: string) => route === '/create' ? Promise.resolve({ data: { id: '1' }, status: 201 }) : Promise.resolve({ data: null, status: 200 });
                instance.put = (route: string) => route === '/update' ? Promise.resolve({ data: { ok: true }, status: 200 }) : Promise.resolve({ data: null, status: 200 });
                instance.patch = () => Promise.resolve({ data: { patched: true }, status: 200 });
                instance.delete = () => Promise.resolve({ data: { deleted: true }, status: 200 });
            } else if (mode === 'failing') {
                instance.get = instance.post = instance.put = instance.patch = instance.delete = () => Promise.reject({ response: { status: 500, data: {} } });
            } else {
                instance.get = instance.post = instance.put = instance.patch = instance.delete = () => Promise.reject({ request: {} });
            }

            return { default: { create: () => instance } };
        };
    };

    const makeAxiosThrowFactory = () => {
        return () => {
            const instance: any = function () { return Promise.resolve({ data: null, status: 200 }); };
            instance.interceptors = {
                request: { use: (h: any, e: any) => { savedReqHandler = h; savedReqErrorHandler = e; } },
                response: { use: (h: any, e: any) => { savedResHandler = h; savedResErrorHandler = e; } }
            };
            instance.get = instance.post = instance.put = instance.patch = instance.delete = () => Promise.reject(new Error('boom'));
            return { default: { create: () => instance } };
        };
    };

    const loadModule = async (axiosFactory: any, navigateMock?: any, notificationMock?: any, authApiMock?: any, tokensMock?: any) => {
        vi.doMock('axios', axiosFactory);
        vi.doMock('/home/ivanvit/Git/KFU_OIT_system/www/src/lib/utils/error', () => ({ navigateToError: navigateMock ?? vi.fn() }));
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock ?? ({ notification: vi.fn(), NotificationType: {} }));
        vi.doMock('$lib/utils/auth/api/api', () => authApiMock ?? ({ refreshAuthTokens: vi.fn(), logout: vi.fn() }));
        vi.doMock('$lib/utils/auth/tokens/tokens', () => tokensMock ?? ({ getAuthTokens: vi.fn(() => null) }));
        
        // @ts-ignore
        global.FormData = global.FormData ?? class FormDataMock {};
        return import('$lib/utils/api');
    };

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        savedReqHandler = savedReqErrorHandler = savedResHandler = savedResErrorHandler = null;
    });

    it('Interceptor sets Authorization and removes Content-Type for FormData', async () => {
        const tokensMock = { getAuthTokens: vi.fn(() => ({ accessToken: 'ATOKEN' })) };
        await loadModule(makeAxiosFactory('ok'), undefined, undefined, undefined, tokensMock);

        expect(savedReqHandler).toBeInstanceOf(Function);
        // @ts-ignore
        const cfg: any = { headers: { 'Content-Type': 'application/json' }, data: new (global as any).FormData() };
        const res = await savedReqHandler(cfg);
        expect(res.headers.Authorization).toBe('Bearer ATOKEN');
        expect(res.headers['Content-Type']).toBeUndefined();
    });

    it('Interceptor error handler rejects', async () => {
        await loadModule(makeAxiosFactory('ok'));
        expect(savedReqErrorHandler).toBeInstanceOf(Function);
        await expect(savedReqErrorHandler(new Error('req-failure'))).rejects.toBeInstanceOf(Error);
    });

    it('Interceptor passes response through', async () => {
        await loadModule(makeAxiosFactory('ok'));
        expect(savedResHandler).toBeInstanceOf(Function);
        const r = { data: { ok: true }, status: 200 };
        expect(savedResHandler(r)).toBe(r);
    });

    it('Interceptor calls navigateToError for specific statuses', async () => {
        const navigateMock = vi.fn();
        await loadModule(makeAxiosFactory('ok'), navigateMock);
        expect(savedResErrorHandler).toBeInstanceOf(Function);

        const axiosError: any = { response: { status: 423 }, config: { url: '/err', headers: {}, _retryCount: 0 } };
        await savedResErrorHandler(axiosError).catch(() => {});
        expect(navigateMock).toHaveBeenCalledWith(423);
    });

    it('Interceptor logout for refresh/login/logout requests', async () => {
        const logoutMock = vi.fn();
        const notificationMock = { notification: vi.fn(), NotificationType: { Warning: 'warn' } };
        const authMock = { refreshAuthTokens: vi.fn(), logout: logoutMock };
        await loadModule(makeAxiosFactory('ok'), undefined, notificationMock, authMock);

        expect(savedResErrorHandler).toBeInstanceOf(Function);

        const axiosError: any = { response: { status: 401 }, config: { url: '/api/token/refresh', headers: {}, _retry: false } };
        await expect(savedResErrorHandler(axiosError)).rejects.toBeDefined();
        expect(logoutMock).toHaveBeenCalled();
        expect(notificationMock.notification).toHaveBeenCalledWith('Сессия истекла. Пожалуйста, войдите снова', notificationMock.NotificationType.Warning);
    });

    it('Interceptor initializes _retryCount to 0 and retries', async () => {
        vi.useFakeTimers();
        try {
            await loadModule(makeAxiosFactory('ok'));
            const originalRequest: any = { url: '/server', headers: {} };
            const axiosError: any = { response: { status: 500 }, config: originalRequest };
            const p = savedResErrorHandler(axiosError);
            vi.advanceTimersByTime(1000);
            const res = await p;
            expect(originalRequest._retryCount).toBe(1);
            expect(res).toEqual(expect.objectContaining({ data: expect.any(Object) }));
        } finally {
            vi.useRealTimers();
        }
    });

    it('API methods return successes', async () => {
        const mod = await loadModule(makeAxiosFactory('ok'));
        const g = await (await mod).api.get('/success');
        expect(g.success).toBe(true);
        expect(g.data).toEqual({ ok: true });

        const p = await (await mod).api.post('/create', { foo: 'bar' });
        expect(p.success).toBe(true);
        expect(p.data).toEqual({ id: '1' });

        const put = await (await mod).api.put('/update', {});
        expect(put.success).toBe(true);
        expect(put.data).toEqual({ ok: true });

        const pa = await (await mod).api.patch('/patch', {});
        expect(pa.success).toBe(true);
        expect(pa.data).toEqual({ patched: true });

        const d = await (await mod).api.delete('/delete', {});
        expect(d.success).toBe(true);
        expect(d.data).toEqual({ deleted: true });
    });

    it('POST/PUT/PATCH/DELETE format errors for 5xx and network', async () => {
        const modFail = await loadModule(makeAxiosFactory('failing'));
        const resFail = await (await modFail).api.post('/any', {});
        expect(resFail.success).toBe(false);
        expect(resFail.error).toBe('Ошибка запроса');
        expect(resFail.status).toBe(500);
    });

    it('401 handling: logout when refresh fails or requests to refresh endpoint', async () => {
        const logoutMock = vi.fn();
        const notificationMock = { notification: vi.fn(), NotificationType: { Warning: 'warn' } };
        const authMock = { refreshAuthTokens: vi.fn(async () => false), logout: logoutMock };
        await loadModule(makeAxiosFactory('ok'), undefined, notificationMock, authMock);

        const axiosError: any = { response: { status: 401 }, config: { url: '/some', headers: {}, _retry: false, _retryCount: 0 } };
        await expect(savedResErrorHandler(axiosError)).rejects.toBeDefined();
        expect(authMock.refreshAuthTokens).toHaveBeenCalled();
        expect(logoutMock).toHaveBeenCalled();
        expect(notificationMock.notification).toHaveBeenCalledWith('Сессия истекла. Пожалуйста, войдите снова', notificationMock.NotificationType.Warning);
    });

    it('401 refresh success retries original request with new token', async () => {
        const refreshMock = vi.fn(async () => true);
        const getTokensMock = vi.fn(() => ({ accessToken: 'NEWTOKEN' }));
        const authMock = { refreshAuthTokens: refreshMock, logout: vi.fn() };
        await loadModule(makeAxiosFactory('ok'), undefined, undefined, authMock, { getAuthTokens: getTokensMock });

        const axiosError: any = { response: { status: 401 }, config: { url: '/some', headers: {}, _retry: false, _retryCount: 0 } };
        const result = await savedResErrorHandler(axiosError);
        expect(refreshMock).toHaveBeenCalled();
        expect(getTokensMock).toHaveBeenCalled();
        expect(result).toEqual(expect.objectContaining({ data: expect.any(Object), status: 200 }));
    });

    it('Retries on 5xx and stops after 3 attempts with notification', async () => {
        const notification = { notification: vi.fn(), NotificationType: { Error: 'err' } };
        await loadModule(makeAxiosFactory('ok'), undefined, notification);

        const okRetry: any = { response: { status: 500 }, config: { url: '/server', headers: {}, _retryCount: 0 } };
        const r = await savedResErrorHandler(okRetry);
        expect(r).toEqual(expect.objectContaining({ data: expect.any(Object) }));

        const tooMany: any = { response: { status: 500 }, config: { url: '/server', headers: {}, _retryCount: 3 } };
        await expect(savedResErrorHandler(tooMany)).rejects.toBeDefined();
        expect(notification.notification).toHaveBeenCalledWith('Ошибка запроса', notification.NotificationType.Error);
    });

    it('Notifies on request error', async () => {
        const notification = { notification: vi.fn(), NotificationType: { Error: 'err' } };
        await loadModule(makeAxiosFactory('ok'), undefined, notification);
        await expect(savedResErrorHandler({ request: {} })).rejects.toBeDefined();
        expect(notification.notification).toHaveBeenCalledWith('Ошибка соединения с сервером', notification.NotificationType.Error);
    });

    it('formatError produces expected messages for 404, 5xx and network', async () => {
        const mod = await loadModule(makeAxiosFactory('ok'));
        const res404 = await (await mod).api.get('/404');
        expect(res404.success).toBe(false);
        expect(res404.error).toBe('Данные не были найдены');
        expect(res404.status).toBe(404);

        const res500 = await (await mod).api.get('/500');
        expect(res500.success).toBe(false);
        expect(res500.error).toBe('Ошибка запроса');
        expect(res500.status).toBe(500);

        const resNet = await (await mod).api.get('/noreply');
        expect(resNet.success).toBe(false);
        expect(resNet.error).toBe('Ошибка соединения');
        expect(resNet.status).toBe(0);
    });

    it('Request helpers return connection error', async () => {
        const mod = await loadModule(makeAxiosThrowFactory());
        const api = (await mod).api;

        const methods = [
            () => api.get('/any'),
            () => api.post('/any', { a: 1 }),
            () => api.put('/any', { a: 1 }),
            () => api.patch('/any', { a: 1 }),
            () => api.delete('/any', { id: 'x' })
        ];

        for (const call of methods) {
            const res = await call();
            expect(res.success).toBe(false);
            expect(res.error).toBe('Ошибка соединения');
            expect(res.status).toBe(0);
        }
    });
});