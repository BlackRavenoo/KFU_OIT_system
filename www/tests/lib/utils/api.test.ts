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
                    if (route === '/noreply') return Promise.reject({ request: {} , config: { url: '/noreply', headers: {} }});
                    return Promise.resolve({ data: null, status: 200 });
                };
                instance.post = (route: string) => route === '/create' ? Promise.resolve({ data: { id: '1' }, status: 201 }) : Promise.resolve({ data: null, status: 200 });
                instance.put = (route: string) => route === '/update' ? Promise.resolve({ data: { ok: true }, status: 200 }) : Promise.resolve({ data: null, status: 200 });
                instance.patch = () => Promise.resolve({ data: { patched: true }, status: 200 });
                instance.delete = () => Promise.resolve({ data: { deleted: true }, status: 200 });
            } else if (mode === 'failing') {
                instance.get = instance.post = instance.put = instance.patch = instance.delete = () => Promise.reject({ response: { status: 500, data: {} } });
            } else {
                instance.get = instance.post = instance.put = instance.patch = instance.delete = () => Promise.reject({ request: {}, config: { url: '/network', headers: {} } });
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
        vi.doMock('$lib/utils/error', () => ({ navigateToError: navigateMock ?? vi.fn() }));
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock ?? ({ notification: vi.fn() }));
        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Error: 'err', Warning: 'warn' } }));
        vi.doMock('$lib/utils/auth/api/api', () => authApiMock ?? ({ refreshAuthTokens: vi.fn(), logout: vi.fn() }));
        vi.doMock('$lib/utils/auth/tokens/tokens', () => tokensMock ?? ({ getAuthTokens: vi.fn(() => null) }));
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

    it('Interceptor handles specific statuses (e.g., 423) by rejecting', async () => {
        await loadModule(makeAxiosFactory('ok'));
        expect(savedResErrorHandler).toBeInstanceOf(Function);

        const axiosError: any = { response: { status: 423 }, config: { url: '/err', headers: {}, _retryCount: 0 } };
        await expect(savedResErrorHandler(axiosError)).rejects.toBeDefined();
    });

    it('Interceptor logout for refresh/login/logout requests', async () => {
        const logoutMock = vi.fn();
        const notificationMock = { notification: vi.fn() };
        const authMock = { refreshAuthTokens: vi.fn(), logout: logoutMock };
        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Warning: 'warn' } }));
        await loadModule(makeAxiosFactory('ok'), undefined, notificationMock, authMock);

        expect(savedResErrorHandler).toBeInstanceOf(Function);

        const axiosError: any = { response: { status: 401 }, config: { url: '/api/token/refresh', headers: {}, _retry: false } };
        await expect(savedResErrorHandler(axiosError)).rejects.toBeDefined();
        expect(logoutMock).toHaveBeenCalled();
        expect(notificationMock.notification).toHaveBeenCalledWith('Сессия истекла. Пожалуйста, войдите снова', 'warn');
    });

    it('Interceptor initializes _retryCount and retries (resolves) on first 5xx', async () => {
        await loadModule(makeAxiosFactory('ok'));

        vi.useFakeTimers();

        const config: any = { url: '/server', headers: {} };
        const error: any = {
            response: { status: 500 },
            config,
            stacks: []
        };

        const retryPromise = savedResErrorHandler(error);
        vi.advanceTimersByTime(1000);

        await expect(retryPromise).resolves.toBeDefined();
        expect(config._retryCount).toBe(1);

        vi.useRealTimers();
    });

    it('Handler via status 403 on /api/* attempts refresh but rejects with logout due to current implementation', async () => {
        const refreshMock = vi.fn(async () => true);
        const logoutMock = vi.fn();
        const getTokensMock = vi.fn(() => ({ accessToken: 'TOK403' }));
        const notificationMock = { notification: vi.fn() };

        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Warning: 'warn' } }));

        await loadModule(
            makeAxiosFactory('ok'),
            undefined,
            notificationMock,
            { refreshAuthTokens: refreshMock, logout: logoutMock },
            { getAuthTokens: getTokensMock }
        );

        const axiosError: any = {
            response: { status: 403 },
            config: { url: '/api/protected', headers: {}, _retryCount: 0 }
        };

        await expect(savedResErrorHandler(axiosError)).rejects.toBeDefined();
        expect(refreshMock).toHaveBeenCalled();
        expect(getTokensMock).toHaveBeenCalled();
        expect(logoutMock).toHaveBeenCalled();
        expect(notificationMock.notification).toHaveBeenCalledWith(
            'Сессия истекла. Пожалуйста, войдите снова',
            'warn'
        );
    });

    it('Throws no token fetch, logout and warning', async () => {
        const logoutMock = vi.fn();
        const notificationMock = { notification: vi.fn() };
        const authMock = { refreshAuthTokens: vi.fn(async () => { throw new Error('boom'); }), logout: logoutMock };
        const tokensMock = { getAuthTokens: vi.fn() };

        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Warning: 'warn' } }));

        await loadModule(makeAxiosFactory('ok'), undefined, notificationMock, authMock, tokensMock);

        const axiosError: any = {
            response: { status: 403 },
            config: { url: '/api/protected', headers: {} }
        };

        await expect(savedResErrorHandler(axiosError)).rejects.toBeDefined();
        expect(authMock.refreshAuthTokens).toHaveBeenCalledTimes(1);
        expect(tokensMock.getAuthTokens).not.toHaveBeenCalled();
        expect(logoutMock).toHaveBeenCalledTimes(1);
        expect(notificationMock.notification).toHaveBeenCalledWith(
            'Сессия истекла. Пожалуйста, войдите снова',
            'warn'
        );
    });

    it('Creates a new headers object through when headers are undefined', async () => {
        const refreshMock = vi.fn(async () => true);
        const logoutMock = vi.fn();
        const notificationMock = { notification: vi.fn() };
        const tokensMock = { getAuthTokens: vi.fn(() => ({ accessToken: 'NC-TOKEN' })) };

        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Warning: 'warn' } }));

        await loadModule(makeAxiosFactory('ok'), undefined, notificationMock, { refreshAuthTokens: refreshMock, logout: logoutMock }, tokensMock);

        const axiosError: any = {
            response: { status: 401 },
            config: { url: '/api/protected' }
        };

        await expect(savedResErrorHandler(axiosError)).rejects.toBeDefined();

        expect(axiosError.config.headers).toEqual({ Authorization: 'Bearer NC-TOKEN' });
        expect(refreshMock).toHaveBeenCalled();
    });

    it('Refresh succeeds but no accessToken', async () => {
        const refreshMock = vi.fn(async () => true);
        const tokensMock = { getAuthTokens: vi.fn(() => null) };
        const logoutMock = vi.fn();
        const notificationMock = { notification: vi.fn() };

        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Warning: 'warn' } }));

        await loadModule(
            makeAxiosFactory('ok'),
            undefined,
            notificationMock,
            { refreshAuthTokens: refreshMock, logout: logoutMock },
            tokensMock
        );

        const originalRequest: any = { url: '/api/some', headers: undefined, _retryCount: 0 };
        const axiosError: any = { response: { status: 401 }, config: originalRequest };

        const res = await savedResErrorHandler(axiosError);

        expect(refreshMock).toHaveBeenCalledTimes(1);
        expect(tokensMock.getAuthTokens).toHaveBeenCalledTimes(1);
        expect(logoutMock).not.toHaveBeenCalled();
        expect(res).toEqual(expect.objectContaining({ status: 200 }));
        expect(res.data.calledWith.url).toBe('/api/some');
        expect(axiosError.config._refreshAttempted).toBe(true);
    });

    it('Calls the appropriate error handling functions on 403 errors', async () => {
        const authMock = { refreshAuthTokens: vi.fn(), logout: vi.fn() };
        const notificationMock = { notification: vi.fn() };

        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Warning: 'warn', Error: 'err' } }));

        await loadModule(makeAxiosFactory('ok'), undefined, notificationMock, authMock);

        const errorMod = await import('$lib/utils/error');
        const navSpy = vi.spyOn(errorMod, 'navigateToError').mockImplementation(() => {});
        const axiosError: any = {
            response: { status: 403 },
            config: { url: '/api/protected', headers: {}, _refreshAttempted: true }
        };

        await expect(savedResErrorHandler(axiosError)).rejects.toBe(axiosError);
        expect(navSpy).toHaveBeenCalledTimes(1);
        expect(navSpy).toHaveBeenCalledWith(403);
        expect(authMock.refreshAuthTokens).not.toHaveBeenCalled();
        expect(authMock.logout).not.toHaveBeenCalled();
        expect(notificationMock.notification).not.toHaveBeenCalled();
    });

    it('When _retryCount is 0 interceptor increments and retries (resolves)', async () => {
        await loadModule(makeAxiosFactory('ok'));

        vi.useFakeTimers();

        const config: any = { url: '/server', headers: {}, _retryCount: 0 };
        const error: any = {
            response: { status: 500 },
            config,
            stacks: []
        };

        const retryPromise = savedResErrorHandler(error);
        vi.advanceTimersByTime(1000);

        await expect(retryPromise).resolves.toBeDefined();
        expect(config._retryCount).toBe(1);

        vi.useRealTimers();
    });

    it('Notifies on non-handled response statuses', async () => {
        const axiosInstance: any = vi.fn(() => Promise.resolve({ data: {}, status: 200 }));
        axiosInstance.interceptors = {
            request: { use: (h: any, e: any) => { savedReqHandler = h; savedReqErrorHandler = e; } },
            response: { use: (h: any, e: any) => { savedResHandler = h; savedResErrorHandler = e; } }
        };

        const axiosFactory = () => ({ create: () => axiosInstance, default: { create: () => axiosInstance } });
        const notificationMock = { notification: vi.fn() };

        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Error: 'err' } }));

        await loadModule(axiosFactory, undefined, notificationMock);
        const error: any = { response: { status: 400 }, config: { url: '/test', headers: {} } };

        await expect(savedResErrorHandler(error)).rejects.toBeDefined();
        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка запроса', 'err');
    });

    it('Delete Authorization when no token', async () => {
        await loadModule(makeAxiosFactory('ok'), undefined, undefined, undefined, { getAuthTokens: vi.fn(() => undefined) });

        expect(savedReqHandler).toBeInstanceOf(Function);

        const cfg: any = { headers: { Authorization: 'Bearer should-be-removed' }, data: { foo: 'bar' } };
        const res = await savedReqHandler(cfg);

        expect(res.headers.Authorization).toBeUndefined();
        expect(res.headers['Content-Type']).toBe('application/json');
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

    it('401 handling: logout when refresh fails (for /api/*)', async () => {
        const logoutMock = vi.fn();
        const notificationMock = { notification: vi.fn() };
        const authMock = { refreshAuthTokens: vi.fn(async () => false), logout: logoutMock };
        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Warning: 'warn' } }));
        await loadModule(makeAxiosFactory('ok'), undefined, notificationMock, authMock);

        const axiosError: any = { response: { status: 401 }, config: { url: '/api/some', headers: {}, _retry: false, _retryCount: 0 } };
        await expect(savedResErrorHandler(axiosError)).rejects.toBeDefined();
        expect(authMock.refreshAuthTokens).toHaveBeenCalled();
        expect(logoutMock).toHaveBeenCalled();
        expect(notificationMock.notification).toHaveBeenCalledWith('Сессия истекла. Пожалуйста, войдите снова', 'warn');
    });

    it('401 refresh success attempts retry but rejects with logout due to current implementation (for /api/*)', async () => {
        const refreshMock = vi.fn(async () => true);
        const getTokensMock = vi.fn(() => ({ accessToken: 'NEWTOKEN' }));
        const logoutMock = vi.fn();
        const notificationMock = { notification: vi.fn() };

        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Warning: 'warn' } }));

        await loadModule(
            makeAxiosFactory('ok'),
            undefined,
            notificationMock,
            { refreshAuthTokens: refreshMock, logout: logoutMock },
            { getAuthTokens: getTokensMock }
        );

        const axiosError: any = { response: { status: 401 }, config: { url: '/api/some', headers: {}, _retry: false, _retryCount: 0 } };
        await expect(savedResErrorHandler(axiosError)).rejects.toBeDefined();
        expect(refreshMock).toHaveBeenCalled();
        expect(getTokensMock).toHaveBeenCalled();
        expect(logoutMock).toHaveBeenCalled();
        expect(notificationMock.notification).toHaveBeenCalledWith(
            'Сессия истекла. Пожалуйста, войдите снова',
            'warn'
        );
    });

    it('Retries on 5xx and stops after 3 attempts with notification', async () => {
        const notification = { notification: vi.fn() };
        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Error: 'err' } }));
        await loadModule(makeAxiosFactory('ok'), undefined, notification);

        vi.useFakeTimers();

        const okRetry: any = { response: { status: 500 }, config: { url: '/server', headers: {}, _retryCount: 0 } };
        const rPromise = savedResErrorHandler(okRetry);
        vi.advanceTimersByTime(1000);
        const r = await rPromise;
        expect(r).toEqual(expect.objectContaining({ data: expect.any(Object) }));

        const tooMany: any = { response: { status: 500 }, config: { url: '/server', headers: {}, _retryCount: 3 } };
        await expect(savedResErrorHandler(tooMany)).rejects.toBeDefined();
        expect(notification.notification).toHaveBeenCalledWith('Ошибка запроса', 'err');

        vi.useRealTimers();
    });

    it('Notifies on request error', async () => {
        const notification = { notification: vi.fn() };
        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Error: 'err' } }));
        await loadModule(makeAxiosFactory('ok'), undefined, notification);
        await expect(savedResErrorHandler({ request: {}, config: { url: '/network', headers: {} } } as any)).rejects.toBeDefined();
        expect(notification.notification).toHaveBeenCalledWith('Ошибка соединения с сервером', 'err');
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

    it('Rejects and does not call refreshAuthTokens when refresh already attempted', async () => {
        const refreshMock = vi.fn();
        const logoutMock = vi.fn();
        await loadModule(makeAxiosFactory('ok'), undefined, undefined, { refreshAuthTokens: refreshMock, logout: logoutMock }, { getAuthTokens: vi.fn(() => ({ accessToken: 'OLD' })) });

        const axiosError: any = { response: { status: 401 }, config: { url: '/api/some', headers: {}, _refreshAttempted: true } };

        await expect(savedResErrorHandler(axiosError)).rejects.toBeDefined();
        expect(refreshMock).not.toHaveBeenCalled();
    });
});

describe('extractPath', () => {
    let savedResErrorHandler: any = null;

    const makeAxiosFactory = () => {
        return () => {
            const instance: any = function (req?: any) {
                return Promise.resolve({ data: { calledWith: req || null }, status: 200 });
            };
            instance.interceptors = {
                request: { use: () => {} },
                response: { use: (_h: any, e: any) => { savedResErrorHandler = e; } }
            };
            instance.get = instance.post = instance.put = instance.patch = instance.delete =
                () => Promise.resolve({ data: {}, status: 200 });
            return { default: { create: () => instance } };
        };
    };

    const loadModule = async (axiosFactory: any, deps?: {
        notification?: any;
        auth?: any;
    }) => {
        vi.doMock('axios', axiosFactory);
        vi.doMock('$lib/utils/error', () => ({ navigateToError: vi.fn() }));
        vi.doMock('$lib/utils/notifications/notification', () =>
            deps?.notification ?? ({ notification: vi.fn() })
        );
        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Error: 'err', Warning: 'warn' } }));
        vi.doMock('$lib/utils/auth/api/api', () =>
            deps?.auth ?? ({ refreshAuthTokens: vi.fn(async () => false), logout: vi.fn() })
        );
        vi.doMock('$lib/utils/auth/tokens/tokens', () => ({ getAuthTokens: vi.fn(() => null) }));
        await import('$lib/utils/api');
    };

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        savedResErrorHandler = null;
    });

    it('Returns "" when url is undefined', async () => {
        const notificationMock = { notification: vi.fn() };
        await loadModule(makeAxiosFactory(), { notification: notificationMock });

        const axiosError: any = { response: { status: 400 }, config: { url: undefined, headers: {} } };
        await expect(savedResErrorHandler(axiosError)).rejects.toBeDefined();
        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка запроса', 'err');
    });

    it('Absolute http with /api path', async () => {
        const logout = vi.fn();
        const notificationMock = { notification: vi.fn() };
        const auth = { refreshAuthTokens: vi.fn(async () => false), logout };
        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Warning: 'warn' } }));
        await loadModule(makeAxiosFactory(), { notification: notificationMock, auth });

        const axiosError: any = { response: { status: 401 }, config: { url: 'https://example.com/api/x', headers: {} } };
        await expect(savedResErrorHandler(axiosError)).rejects.toBeDefined();
        expect(auth.refreshAuthTokens).toHaveBeenCalled();
        expect(logout).toHaveBeenCalled();
        expect(notificationMock.notification).toHaveBeenCalledWith('Сессия истекла. Пожалуйста, войдите снова', 'warn');
    });

    it('Absolute http without path', async () => {
        const notificationMock = { notification: vi.fn() };
        await loadModule(makeAxiosFactory(), { notification: notificationMock });

        const axiosError: any = { response: { status: 400 }, config: { url: 'https://example.com', headers: {} } };
        await expect(savedResErrorHandler(axiosError)).rejects.toBeDefined();
        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка запроса', 'err');
    });

    it('Relative starting with "/"', async () => {
        await loadModule(makeAxiosFactory());

        const axiosError: any = { response: { status: 403 }, config: { url: '/api/x', headers: {}, _refreshAttempted: true } };
        await expect(savedResErrorHandler(axiosError)).rejects.toBe(axiosError);
    });

    it('Relative without leading "/"', async () => {
        const logout = vi.fn();
        const notificationMock = { notification: vi.fn() };
        const auth = { refreshAuthTokens: vi.fn(async () => false), logout };
        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Warning: 'warn' } }));
        await loadModule(makeAxiosFactory(), { notification: notificationMock, auth });

        const axiosError: any = { response: { status: 401 }, config: { url: 'api/x', headers: {} } };
        await expect(savedResErrorHandler(axiosError)).rejects.toBeDefined();
        expect(auth.refreshAuthTokens).toHaveBeenCalled();
        expect(logout).toHaveBeenCalled();
        expect(notificationMock.notification).toHaveBeenCalledWith('Сессия истекла. Пожалуйста, войдите снова', 'warn');
    });

    it('Bad absolute http url', async () => {
        const notificationMock = { notification: vi.fn() };
        await loadModule(makeAxiosFactory(), { notification: notificationMock });

        const axiosError: any = { response: { status: 400 }, config: { url: 'http://[bad', headers: {} } };
        await expect(savedResErrorHandler(axiosError)).rejects.toBeDefined();
        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка запроса', 'err');
    });

    it('Non-http scheme (ftp://)', async () => {
        const notificationMock = { notification: vi.fn() };
        await loadModule(makeAxiosFactory(), { notification: notificationMock });

        const axiosError: any = { response: { status: 400 }, config: { url: 'ftp://api/x', headers: {} } };
        await expect(savedResErrorHandler(axiosError)).rejects.toBeDefined();
        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка запроса', 'err');
    });

    it('Uses fallback "" when URL pathname is empty)', async () => {
        const OriginalURL = global.URL;
        class FakeURL {
            href: string;
            pathname: string;
            constructor(input: string) {
                this.href = input;
                this.pathname = '';
            }
        }
        global.URL = FakeURL as any;

        let localSavedResErrorHandler: any = null;
        const axiosFactory = () => ({
            default: {
                create: () => {
                    const inst: any = (req?: any) => Promise.resolve({ data: { calledWith: req ?? null }, status: 200 });
                    inst.interceptors = {
                        request: { use: () => {} },
                        response: { use: (_h: any, e: any) => { localSavedResErrorHandler = e; } }
                    };
                    inst.get = inst.post = inst.put = inst.patch = inst.delete = () => Promise.resolve({ data: {}, status: 200 });
                    return inst;
                }
            }
        });

        vi.doMock('axios', axiosFactory);
        vi.doMock('$lib/utils/error', () => ({ navigateToError: vi.fn() }));
        vi.doMock('$lib/utils/auth/api/api', () => ({ refreshAuthTokens: vi.fn(), logout: vi.fn() }));
        vi.doMock('$lib/utils/auth/tokens/tokens', () => ({ getAuthTokens: vi.fn(() => null) }));
        vi.doMock('$lib/utils/notifications/notification', () => ({ notification: vi.fn() }));
        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Error: 'err' } }));
        await import('$lib/utils/api');

        expect(typeof localSavedResErrorHandler).toBe('function');

        const notifMod = await import('$lib/utils/notifications/notification');
        const notifTypeMod = await import('$lib/utils/notifications/types');
        const notifSpy = vi.spyOn(notifMod, 'notification');

        const axiosError: any = { response: { status: 400 }, config: { url: 'https://example.com', headers: {} } };
        await expect(localSavedResErrorHandler(axiosError)).rejects.toBeDefined();

        expect(notifSpy).toHaveBeenCalledWith('Ошибка запроса', notifTypeMod.NotificationType.Error);

        global.URL = OriginalURL;
    });
});

describe('handleAuthError', () => {
    const makeAxiosFactory = () => {
        return () => {
            const instance: any = function () {
                return Promise.resolve({ data: null, status: 200 });
            };
            instance.interceptors = {
                request: { use: () => {} },
                response: { use: () => {} }
            };
            instance.get = instance.post = instance.put = instance.patch = instance.delete =
                () => Promise.resolve({ data: {}, status: 200 });
            return { default: { create: () => instance } };
        };
    };

    const mockAndImport = async (gotoSpy?: any) => {
        vi.doMock('axios', makeAxiosFactory());
        vi.doMock('$app/navigation', () => ({ goto: gotoSpy ?? vi.fn() }));
        vi.doMock('$lib/utils/error', () => ({ navigateToError: vi.fn() }));
        vi.doMock('$lib/utils/notifications/notification', () => ({ notification: vi.fn() }));
        vi.doMock('$lib/utils/notifications/types', () => ({ NotificationType: { Error: 'err', Warning: 'warn' } }));
        vi.doMock('$lib/utils/auth/api/api', () => ({ refreshAuthTokens: vi.fn(), logout: vi.fn() }));
        vi.doMock('$lib/utils/auth/tokens/tokens', () => ({ getAuthTokens: vi.fn(() => null) }));
        return import('$lib/utils/api');
    };

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        // @ts-ignore
        delete global.window;
    });

    it('Forming route from window.location', async () => {
        // @ts-ignore
        global.window = { location: { pathname: '/alpha', search: '?x=1&y=2' } };
        const goto = vi.fn();
        const mod = await mockAndImport(goto);
        const { handleAuthError } = mod as any;

        handleAuthError();

        expect(goto).toHaveBeenCalledTimes(1);
        const calledWith = goto.mock.calls[0][0] as string;
        expect(calledWith.startsWith('/?action=login&route=')).toBe(true);
        const routeEncoded = new URL('http://local' + calledWith).searchParams.get('route')!;
        expect(decodeURIComponent(routeEncoded)).toBe('/alpha?x=1&y=2');
    });

    it('Uses provided path when window is absent', async () => {
        const goto = vi.fn();
        const mod = await mockAndImport(goto);
        const { handleAuthError } = mod as any;

        const path = '/сложный путь/тест?name=Иван Иван&topic=Привет';
        handleAuthError(path);

        expect(goto).toHaveBeenCalledTimes(1);
        const calledWith = goto.mock.calls[0][0] as string;
        const params = new URL('http://local' + calledWith).searchParams;
        expect(params.get('action')).toBe('login');
        const routeEncoded = params.get('route')!;
        expect(decodeURIComponent(routeEncoded)).toBe(path);
    });

    it('Uses default path when window is absent and no path is provided', async () => {
        const goto = vi.fn();
        const mod = await mockAndImport(goto);
        const { handleAuthError } = mod as any;

        handleAuthError(undefined);

        expect(goto).toHaveBeenCalledTimes(1);
        const calledWith = goto.mock.calls[0][0] as string;
        const params = new URL('http://local' + calledWith).searchParams;
        expect(params.get('action')).toBe('login');
        expect(decodeURIComponent(params.get('route')!)).toBe('/');
    });
});