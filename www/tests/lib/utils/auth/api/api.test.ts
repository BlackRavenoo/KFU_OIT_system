import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { get } from "svelte/store";

vi.mock("$lib/utils/auth/tokens/storage", () => ({
    setTokenStore: vi.fn(),
}));

vi.mock("$lib/utils/auth/tokens/tokens", () => ({
    getAuthTokens: vi.fn(),
    clearAuthTokens: vi.fn(),
    isTokenValid: vi.fn(),
}));

vi.mock("$lib/utils/auth/storage/initial", () => ({
    currentUser: {
        subscribe: (run: (v: any) => void) => { run(null); return () => {}; },
        set: vi.fn()
    },
    isAuthenticated: {
        subscribe: (run: (v: any) => void) => { run(false); return () => {}; },
        set: vi.fn()
    },
}));

vi.mock("$lib/utils/api", () => ({
    api: {
        post: vi.fn(),
        get: vi.fn(),
    },
}));

vi.mock("@fingerprintjs/fingerprintjs", () => {
    const load = vi.fn();
    return {
        default: { load },
        load
    };
});

const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
};

Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true
});

const authApi = await import("$lib/utils/auth/api/api");
const tokensModule = await import("$lib/utils/auth/tokens/tokens");
const storageModule = await import("$lib/utils/auth/tokens/storage");
const initialStore = await import("$lib/utils/auth/storage/initial");
const apiModule = await import("$lib/utils/api");
const FingerprintJS = await import("@fingerprintjs/fingerprintjs");

beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("Auth API", () => {
    it("Does not schedule refresh when token payload has no exp", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue({ refreshToken: "r1" } as any);

        const fpGet = vi.fn().mockResolvedValue({ visitorId: "fp-id" });
        const fpLoad = (FingerprintJS as any).load || (FingerprintJS as any).default.load;
        fpLoad.mockResolvedValue({ get: fpGet });

        const payloadNoExp = {};
        const base64Payload = typeof btoa === "function"
            ? btoa(JSON.stringify(payloadNoExp)) // @ts-ignore
            : Buffer.from(JSON.stringify(payloadNoExp)).toString("base64");
        const tokenNoExp = `a.${base64Payload}.c`;

        (apiModule as any).api.post.mockResolvedValueOnce({
            success: true,
            data: { access_token: tokenNoExp, refresh_token: "refX" }
        } as any);

        const setTokenSpy = vi.spyOn(storageModule as any, "setTokenStore").mockImplementation(() => undefined as any);
        
        localStorageMock.removeItem.mockImplementation(() => {});
        
        await (authApi as any).login("e", "p", true);

        expect(setTokenSpy).toHaveBeenCalled();
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('user_data_cache');

        vi.advanceTimersByTime(24 * 60 * 60 * 1000);
        await Promise.resolve();

        expect((apiModule as any).api.post).toHaveBeenCalledTimes(1);
    });

    it("Trying refresh with no access token", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue(undefined as any);

        const res = await (authApi as any).refreshAuthTokens();
        expect(res).toBe(false);
    });

    it("Refresh auth tokens successfully", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue({ refreshToken: "r1" } as any);

        const fpGet = vi.fn().mockResolvedValue({ visitorId: "fp-id" });
        (FingerprintJS as any).load ?
            (FingerprintJS as any).load.mockResolvedValue({ get: fpGet }) :
            (FingerprintJS as any).default.load.mockResolvedValue({ get: fpGet });

        (apiModule as any).api.post.mockResolvedValueOnce({
            success: true,
            data: { access_token: "a1", refresh_token: "r2" }
        } as any);

        const setTokenSpy = vi.spyOn(storageModule as any, "setTokenStore").mockImplementation(() => undefined as any);
        const result = await (authApi as any).refreshAuthTokens();
        const fpLoad = (FingerprintJS as any).load || (FingerprintJS as any).default.load;

        expect(fpLoad).toHaveBeenCalled();
        expect(fpGet).toHaveBeenCalled();
        expect(setTokenSpy).toHaveBeenCalledWith({ accessToken: "a1", refreshToken: "r2" });
        expect(result).toBe(true);
    });

    it("POST throws error in refreshAuthTokens", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue({ refreshToken: "r_fail" } as any);

        const fpGet = vi.fn().mockResolvedValue({ visitorId: "fp-id" });
        const fpLoad = (FingerprintJS as any).load || (FingerprintJS as any).default.load;
        fpLoad.mockResolvedValue({ get: fpGet });

        (apiModule as any).api.post.mockRejectedValueOnce(new Error("network error"));

        const res = await (authApi as any).refreshAuthTokens();
        expect(res).toBe(false);
    });

    it("Token refresh response missing tokens", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue({ refreshToken: "r_missing" } as any);

        const fpGet = vi.fn().mockResolvedValue({ visitorId: "fp-id" });
        const fpLoad = (FingerprintJS as any).load || (FingerprintJS as any).default.load;
        fpLoad.mockResolvedValue({ get: fpGet });

        (apiModule as any).api.post.mockResolvedValueOnce({
            success: true,
            data: { access_token: "only_access" }
        } as any);

        const res1 = await (authApi as any).refreshAuthTokens();
        expect(res1).toBe(false);

        (apiModule as any).api.post.mockResolvedValueOnce({ success: false } as any);

        const res2 = await (authApi as any).refreshAuthTokens();
        expect(res2).toBe(false);
    });

    it("Login stores refresh token when rememberMe = true", async () => {
        const fpGet = vi.fn().mockResolvedValue({ visitorId: "fp-login2" });
        const fpLoad = (FingerprintJS as any).load || (FingerprintJS as any).default.load;
        fpLoad.mockResolvedValue({ get: fpGet });

        (apiModule as any).api.post.mockResolvedValueOnce({
            success: true,
            data: { access_token: "acc2", refresh_token: "ref2" }
        } as any);

        const setTokenSpy = vi.spyOn(storageModule as any, "setTokenStore").mockImplementation(() => undefined as any);
        localStorageMock.removeItem.mockImplementation(() => {});
        
        await (authApi as any).login("e", "p", true);

        expect(setTokenSpy.mock.calls[0][0]).toEqual({ accessToken: "acc2", refreshToken: "ref2" });
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('user_data_cache');
    });

    it("Logout clears tokens, resets stores and redirects", async () => {
        const clearSpy = vi.spyOn(tokensModule as any, "clearAuthTokens").mockImplementation(() => undefined as any);
        const authSetSpy = vi.spyOn((initialStore as any).isAuthenticated, "set").mockImplementation(() => undefined as any);
        const userSetSpy = vi.spyOn((initialStore as any).currentUser, "set").mockImplementation(() => undefined as any);

        delete (globalThis as any).location;
        (globalThis as any).location = { href: "/somewhere" };

        await (authApi as any).logout();

        expect(clearSpy).toHaveBeenCalled();
        expect(authSetSpy).toHaveBeenCalledWith(false);
        expect(userSetSpy).toHaveBeenCalledWith(null);
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('user_data_cache');
        expect((globalThis as any).location.href).toBe("/");
    });

    it("Logout handles localStorage errors gracefully", async () => {
        localStorageMock.removeItem.mockImplementation(() => {
            throw new Error('LocalStorage error');
        });

        const clearSpy = vi.spyOn(tokensModule as any, "clearAuthTokens").mockImplementation(() => undefined as any);
        const authSetSpy = vi.spyOn((initialStore as any).isAuthenticated, "set").mockImplementation(() => undefined as any);
        const userSetSpy = vi.spyOn((initialStore as any).currentUser, "set").mockImplementation(() => undefined as any);

        delete (globalThis as any).location;
        (globalThis as any).location = { href: "/somewhere" };

        await expect((authApi as any).logout()).resolves.toBeUndefined();

        expect(clearSpy).toHaveBeenCalled();
        expect(authSetSpy).toHaveBeenCalledWith(false);
        expect(userSetSpy).toHaveBeenCalledWith(null);
        expect((globalThis as any).location.href).toBe("/");
    });

    it("Clears scheduled refresh timeout during logout", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue({ refreshToken: "r1" } as any);

        const fpGet = vi.fn().mockResolvedValue({ visitorId: "fp-id" });
        const fpLoad = (FingerprintJS as any).load || (FingerprintJS as any).default.load;
        fpLoad.mockResolvedValue({ get: fpGet });

        const payload = { exp: Math.floor((Date.now() - 1000) / 1000) };
        const base64Payload = typeof btoa === "function"
            ? btoa(JSON.stringify(payload)) // @ts-ignore
            : Buffer.from(JSON.stringify(payload)).toString("base64");
        const immediateToken = `a.${base64Payload}.c`;

        (apiModule as any).api.post
            .mockResolvedValueOnce({ success: true, data: { access_token: immediateToken, refresh_token: "refX" } } as any)
            .mockResolvedValueOnce({ success: true, data: { access_token: "a_after_refresh", refresh_token: "r_after" } } as any);

        const setTokenSpy = vi.spyOn(storageModule as any, "setTokenStore").mockImplementation(() => undefined as any);
        const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
        localStorageMock.removeItem.mockImplementation(() => {});

        await (authApi as any).login("e", "p", true);
        expect(setTokenSpy).toHaveBeenCalled();

        await (authApi as any).logout();

        expect(clearTimeoutSpy).toHaveBeenCalled();

        vi.advanceTimersByTime(0);
        await Promise.resolve();

        expect((apiModule as any).api.post).toHaveBeenCalledTimes(1);

        clearTimeoutSpy.mockRestore();
    });

    it("Throw error when no access token in user data", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue(undefined as any);
        await expect((authApi as any).getUserData()).rejects.toBeDefined();
    });

    it("Set data of current user from API when no cache", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue({ accessToken: "acc" } as any);
        const user = { id: 1, name: "u" };
        
        localStorageMock.getItem.mockReturnValue(null);
        (apiModule as any).api.get.mockResolvedValueOnce({ success: true, data: user } as any);

        const userSetSpy = vi.spyOn((initialStore as any).currentUser, "set").mockImplementation(() => undefined as any);
        const res = await (authApi as any).getUserData();
        
        expect(userSetSpy).toHaveBeenCalledWith(user);
        expect(res).toEqual(user);
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'user_data_cache',
            expect.stringContaining('"data":{"id":1,"name":"u"}')
        );
    });

    it("Load user data from cache when available and not expired", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue({ accessToken: "acc" } as any);
        
        const cachedUser = { id: 2, name: "cached" };
        const cachedData = {
            timestamp: Date.now() - 5 * 60 * 1000,
            data: cachedUser
        };
        localStorageMock.getItem.mockReturnValue(JSON.stringify(cachedData));

        const userSetSpy = vi.spyOn((initialStore as any).currentUser, "set").mockImplementation(() => undefined as any);
        const res = await (authApi as any).getUserData();
        
        expect(userSetSpy).toHaveBeenCalledWith(cachedUser);
        expect(res).toEqual(cachedUser);
        expect((apiModule as any).api.get).not.toHaveBeenCalled();
    });

    it("Fetch fresh data when cache is expired", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue({ accessToken: "acc" } as any);
        
        const expiredCachedData = {
            timestamp: Date.now() - 20 * 60 * 1000,
            data: { id: 3, name: "expired" }
        };
        localStorageMock.getItem.mockReturnValue(JSON.stringify(expiredCachedData));
        
        const freshUser = { id: 4, name: "fresh" };
        (apiModule as any).api.get.mockResolvedValueOnce({ success: true, data: freshUser } as any);

        const userSetSpy = vi.spyOn((initialStore as any).currentUser, "set").mockImplementation(() => undefined as any);
        const res = await (authApi as any).getUserData();
        
        expect(userSetSpy).toHaveBeenCalledWith(freshUser);
        expect(res).toEqual(freshUser);
        expect((apiModule as any).api.get).toHaveBeenCalled();
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'user_data_cache',
            expect.stringContaining('"data":{"id":4,"name":"fresh"}')
        );
    });

    it("Handle corrupted cache gracefully", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue({ accessToken: "acc" } as any);
        
        localStorageMock.getItem.mockReturnValue('invalid-json');
        
        const user = { id: 5, name: "recovered" };
        (apiModule as any).api.get.mockResolvedValueOnce({ success: true, data: user } as any);

        const userSetSpy = vi.spyOn((initialStore as any).currentUser, "set").mockImplementation(() => undefined as any);
        const res = await (authApi as any).getUserData();
        
        expect(userSetSpy).toHaveBeenCalledWith(user);
        expect(res).toEqual(user);
        expect((apiModule as any).api.get).toHaveBeenCalled();
    });

    it("Handle localStorage setItem errors gracefully", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue({ accessToken: "acc" } as any);
        
        localStorageMock.getItem.mockReturnValue(null);
        localStorageMock.setItem.mockImplementation(() => {
            throw new Error('LocalStorage is full');
        });
        
        const user = { id: 6, name: "test" };
        (apiModule as any).api.get.mockResolvedValueOnce({ success: true, data: user } as any);

        const userSetSpy = vi.spyOn((initialStore as any).currentUser, "set").mockImplementation(() => undefined as any);
        const res = await (authApi as any).getUserData();
        
        expect(userSetSpy).toHaveBeenCalledWith(user);
        expect(res).toEqual(user);
    });

    it("Sets auth and fetches user if needed on auth check", async () => {
        const tokens = { accessToken: "acc" };
        localStorageMock.getItem.mockReturnValue(JSON.stringify(tokens));
        vi.resetModules();

        const freshTokensModule = await import("$lib/utils/auth/tokens/tokens");
        const freshInitialStore = await import("$lib/utils/auth/storage/initial");
        const freshAuthApi = await import("$lib/utils/auth/api/api");

        vi.spyOn(freshTokensModule as any, "isTokenValid").mockReturnValue(true as any);
        const user = { id: 2, name: "test" };
        vi.spyOn(freshAuthApi as any, "getUserData").mockResolvedValueOnce(user as any);

        const authSetSpy = vi.spyOn((freshInitialStore as any).isAuthenticated, "set").mockImplementation(() => undefined as any);
        await (freshAuthApi as any).checkAuthentication();

        expect(authSetSpy).toHaveBeenCalledWith(true);
        expect(get((freshAuthApi as any).authCheckComplete)).toBe(true);
    });

    it("Throw error with API error response during get user data", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue({ accessToken: "acc" } as any);
        localStorageMock.getItem.mockReturnValue(null);
        (apiModule as any).api.get.mockResolvedValueOnce({ success: false, error: "api down" } as any);
        await expect((authApi as any).getUserData()).rejects.toThrow("api down");
    });

    it("Throw error when user data is missing", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue({ accessToken: "acc" } as any);
        localStorageMock.getItem.mockReturnValue(null);
        (apiModule as any).api.get.mockResolvedValueOnce({ success: true } as any);
        await expect((authApi as any).getUserData()).rejects.toThrow("Failed to fetch user data");
    });

    it("Schedules immediate refresh", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue({ refreshToken: "r1" } as any);

        const fpGet = vi.fn().mockResolvedValue({ visitorId: "fp-id" });
        const fpLoad = (FingerprintJS as any).load || (FingerprintJS as any).default.load;
        fpLoad.mockResolvedValue({ get: fpGet });

        const payload = { exp: Math.floor((Date.now() - 1000) / 1000) };
        const base64Payload = typeof btoa === "function" 
            ? btoa(JSON.stringify(payload)) 
            : Buffer.from(JSON.stringify(payload)).toString("base64");
        const immediateToken = `a.${base64Payload}.c`;

        (apiModule as any).api.post.mockResolvedValueOnce({
            success: true,
            data: { access_token: immediateToken, refresh_token: "refX" }
        } as any);
        (apiModule as any).api.post.mockResolvedValueOnce({
            success: true,
            data: { access_token: "a_new", refresh_token: "r_new" }
        } as any);

        const setTokenSpy = vi.spyOn(storageModule as any, "setTokenStore").mockImplementation(() => undefined as any);
        localStorageMock.removeItem.mockImplementation(() => {});
        
        await (authApi as any).login("e", "p", true);

        expect(setTokenSpy).toHaveBeenCalled();

        vi.advanceTimersByTime(0);
        await Promise.resolve();

        expect((apiModule as any).api.post).toHaveBeenCalled();
    });

    it("Does not schedule refresh when calculated delay exceeds setTimeout max", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue({ refreshToken: "r1" } as any);

        const fpGet = vi.fn().mockResolvedValue({ visitorId: "fp-far" });
        const fpLoad = (FingerprintJS as any).load || (FingerprintJS as any).default.load;
        fpLoad.mockResolvedValue({ get: fpGet });

        const nowSec = Math.floor(Date.now() / 1000);
        const hugeDelaySec = 2147483647 + 10;
        const expSec = nowSec + hugeDelaySec + 5 * 60;
        const payload = { exp: expSec };

        const base64Payload = typeof btoa === "function"
            ? btoa(JSON.stringify(payload)) // @ts-ignore
            : Buffer.from(JSON.stringify(payload)).toString("base64");
        const hugeToken = `a.${base64Payload}.c`;

        (apiModule as any).api.post.mockResolvedValueOnce({
            success: true,
            data: { access_token: hugeToken, refresh_token: "refHuge" }
        } as any);
        (apiModule as any).api.post.mockResolvedValueOnce({
            success: true,
            data: { access_token: "should_not_happen", refresh_token: "nope" }
        } as any);

        const setTokenSpy = vi.spyOn(storageModule as any, "setTokenStore").mockImplementation(() => undefined as any);
        localStorageMock.removeItem.mockImplementation(() => {});

        await (authApi as any).login("e", "p", true);
        expect(setTokenSpy).toHaveBeenCalled();

        vi.advanceTimersByTime(3000);
        await Promise.resolve();

        expect((apiModule as any).api.post).toHaveBeenCalledTimes(1);
    });

    it("Schedules refresh when delay is positive and within 32-bit signed int range", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue({ refreshToken: "r2" } as any);

        const fpGet = vi.fn().mockResolvedValue({ visitorId: "fp-near" });
        const fpLoad = (FingerprintJS as any).load || (FingerprintJS as any).default.load;
        fpLoad.mockResolvedValue({ get: fpGet });

        const nowSec = Math.floor(Date.now() / 1000);
        const expSec = nowSec + 15 * 60; 
        const payload = { exp: expSec };

        const base64Payload = typeof btoa === "function"
            ? btoa(JSON.stringify(payload)) // @ts-ignore
            : Buffer.from(JSON.stringify(payload)).toString("base64");
        const nearToken = `a.${base64Payload}.c`;

        (apiModule as any).api.post.mockResolvedValueOnce({
            success: true,
            data: { access_token: nearToken, refresh_token: "refNear" }
        } as any);
        (apiModule as any).api.post.mockResolvedValueOnce({
            success: true,
            data: { access_token: "a_refreshed", refresh_token: "r_refreshed" }
        } as any);

        const setTokenSpy = vi.spyOn(storageModule as any, "setTokenStore").mockImplementation(() => undefined as any);
        localStorageMock.removeItem.mockImplementation(() => {});

        await (authApi as any).login("e", "p", true);
        expect(setTokenSpy).toHaveBeenCalled();
    });

    it("Not store tokens when response is unsuccessful", async () => {
        const fpGet = vi.fn().mockResolvedValue({ visitorId: "fp-login-fail" });
        const fpLoad = (FingerprintJS as any).load || (FingerprintJS as any).default.load;
        fpLoad.mockResolvedValue({ get: fpGet });

        (apiModule as any).api.post.mockResolvedValueOnce({
            success: false
        } as any);

        const setTokenSpy = vi.spyOn(storageModule as any, "setTokenStore").mockImplementation(() => undefined as any);

        const res = await (authApi as any).login("e", "p", true);

        expect(fpGet).toHaveBeenCalled();
        expect(setTokenSpy).not.toHaveBeenCalled();
        expect(res).toBeUndefined();
    });

    it("Use default rememberMe in login", async () => {
        const fpGet = vi.fn().mockResolvedValue({ visitorId: "fp-default" });
        const fpLoad = (FingerprintJS as any).load || (FingerprintJS as any).default.load;
        fpLoad.mockResolvedValue({ get: fpGet });

        (apiModule as any).api.post.mockResolvedValueOnce({
            success: true,
            data: { access_token: "acc_default", refresh_token: "ref_default" }
        } as any);

        const setTokenSpy = vi.spyOn(storageModule as any, "setTokenStore").mockImplementation(() => undefined as any);
        localStorageMock.removeItem.mockImplementation(() => {});

        const res = await (authApi as any).login("e", "p");

        expect(fpGet).toHaveBeenCalled();
        expect(setTokenSpy).toHaveBeenCalledWith({ accessToken: "acc_default", refreshToken: undefined });
        expect(res).toEqual({ access_token: "acc_default", refresh_token: "ref_default" });
    });

    it("Returns when tokens doesnt refresh", async () => {
        (authApi as any).isRefreshing = true;
        const refreshSpy = vi.spyOn(authApi as any, "refreshAuthTokens").mockResolvedValue(true as any);

        const fpGet = vi.fn().mockResolvedValue({ visitorId: "fp-id" });
        const fpLoad = (FingerprintJS as any).load || (FingerprintJS as any).default.load;
        fpLoad.mockResolvedValue({ get: fpGet });

        const payload = { exp: Math.floor((Date.now() - 1000) / 1000) };
        const base64Payload = typeof btoa === "function"
            ? btoa(JSON.stringify(payload)) // @ts-ignore
            : Buffer.from(JSON.stringify(payload)).toString("base64");
        const immediateToken = `a.${base64Payload}.c`;

        (apiModule as any).api.post.mockResolvedValueOnce({
            success: true,
            data: { access_token: immediateToken, refresh_token: "refX" }
        } as any);

        localStorageMock.removeItem.mockImplementation(() => {});

        await (authApi as any).login("e", "p", true);
        vi.advanceTimersByTime(0);
        await Promise.resolve();

        expect(refreshSpy).not.toHaveBeenCalled();
        (authApi as any).isRefreshing = false;
    });

    it("Second scheduled tryRefresh exits immediately", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue({ refreshToken: "r1" } as any);

        const fpGet = vi.fn().mockResolvedValue({ visitorId: "fp-id" });
        const fpLoad = (FingerprintJS as any).load || (FingerprintJS as any).default.load;
        fpLoad.mockResolvedValue({ get: fpGet });

        const payload = { exp: Math.floor((Date.now() - 1000) / 1000) };
        const base64Payload = typeof btoa === "function"
            ? btoa(JSON.stringify(payload)) // @ts-ignore
            : Buffer.from(JSON.stringify(payload)).toString("base64");
        const immediateToken = `a.${base64Payload}.c`;

        const hangingPromise = new Promise<any>(() => {});

        (apiModule as any).api.post
            .mockResolvedValueOnce({ success: true, data: { access_token: immediateToken, refresh_token: "ref1" } })
            .mockImplementationOnce(() => hangingPromise)
            .mockResolvedValueOnce({ success: true, data: { access_token: immediateToken, refresh_token: "ref2" } });

        localStorageMock.removeItem.mockImplementation(() => {});

        await (authApi as any).login("e1", "p1", true);
        vi.advanceTimersByTime(0);
        await Promise.resolve();

        await (authApi as any).login("e2", "p2", true);
        vi.advanceTimersByTime(0);
        await Promise.resolve();

        expect((apiModule as any).api.post).toHaveBeenCalledTimes(3);
    });

    it("Schedule new refresh when refreshAuthTokens returns true and new token exists", async () => {
        vi.resetModules();

        const authApi = await import("$lib/utils/auth/api/api");
        const tokensModule = await import("$lib/utils/auth/tokens/tokens");
        const storageModule = await import("$lib/utils/auth/tokens/storage");
        const apiModule = await import("$lib/utils/api");
        const FingerprintJS = await import("@fingerprintjs/fingerprintjs");

        let currentTokens: any = undefined;
        vi.spyOn(tokensModule as any, "getAuthTokens").mockImplementation(() => currentTokens);
        const setTokenSpy = vi.spyOn(storageModule as any, "setTokenStore").mockImplementation((t: any) => { currentTokens = t; });

        const fpGet = vi.fn().mockResolvedValue({ visitorId: "fp-id" });
        const fpLoad = (FingerprintJS as any).load || (FingerprintJS as any).default.load;
        fpLoad.mockResolvedValue({ get: fpGet });

        const expiredPayload = { exp: Math.floor((Date.now() - 1000) / 1000) };
        const base64Expired = typeof btoa === "function"
            ? btoa(JSON.stringify(expiredPayload)) // @ts-ignore
            : Buffer.from(JSON.stringify(expiredPayload)).toString("base64");
        const immediateToken = `a.${base64Expired}.c`;

        const futurePayload = { exp: Math.floor(Date.now() / 1000) + 60 * 60 };
        const base64Future = typeof btoa === "function"
            ? btoa(JSON.stringify(futurePayload)) // @ts-ignore
            : Buffer.from(JSON.stringify(futurePayload)).toString("base64");
        const futureToken = `a.${base64Future}.c`;

        (apiModule as any).api.post
            .mockResolvedValueOnce({
                success: true,
                data: { access_token: immediateToken, refresh_token: "refX" }
            } as any)
            .mockResolvedValueOnce({
                success: true,
                data: { access_token: futureToken, refresh_token: "r_new" }
            } as any);

        const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
        localStorageMock.removeItem.mockImplementation(() => {});

        await (authApi as any).login("e", "p", true);
        expect(setTokenSpy).toHaveBeenCalledTimes(1);

        await vi.runAllTimersAsync();
        await Promise.resolve();

        expect(setTokenSpy).toHaveBeenCalledTimes(2)
        expect(setTimeoutSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

        setTimeoutSpy.mockRestore();
    });

    it("Login logs warning when localStorage.removeItem throws", async () => {
        const fpGet = vi.fn().mockResolvedValue({ visitorId: "fp-warn" });
        const fpLoad = (FingerprintJS as any).load || (FingerprintJS as any).default.load;
        fpLoad.mockResolvedValue({ get: fpGet });

        (apiModule as any).api.post.mockResolvedValueOnce({
            success: true,
            data: { access_token: "acc_warn", refresh_token: "ref_warn" }
        } as any);

        const setTokenSpy = vi.spyOn(storageModule as any, "setTokenStore").mockImplementation(() => undefined as any);
        localStorageMock.removeItem.mockImplementation(() => { throw new Error("localStorage error"); });
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        try {
            await (authApi as any).login("e", "p", true);

            expect(setTokenSpy).toHaveBeenCalledWith({ accessToken: "acc_warn", refreshToken: "ref_warn" });
            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(warnSpy).toHaveBeenCalledWith('Не удалось очистить кеш пользователя');
        } finally {
            warnSpy.mockRestore();
        }
    });

    it("Exit from authentication check when no tokenData in localStorage", async () => {
        localStorageMock.getItem.mockReturnValue(null);

        const authSetSpy = vi.spyOn((initialStore as any).isAuthenticated, "set").mockImplementation(() => undefined as any);

        await (authApi as any).checkAuthentication();

        expect(authSetSpy).not.toHaveBeenCalledWith(true);
        expect(get((authApi as any).authCheckComplete)).toBe(true);
    });

    it("Handles invalid JSON in authentication check", async () => {
        localStorageMock.getItem.mockReturnValue("not-json");

        const clearSpy = vi.spyOn(tokensModule as any, "clearAuthTokens").mockImplementation(() => undefined as any);
        const authSetSpy = vi.spyOn((initialStore as any).isAuthenticated, "set").mockImplementation(() => undefined as any);

        await (authApi as any).checkAuthentication();

        expect(authSetSpy).toHaveBeenCalledWith(false);
        expect(clearSpy).toHaveBeenCalled();
        expect(get((authApi as any).authCheckComplete)).toBe(true);
    });

    it("Check authentication without accessToken", async () => {
        localStorageMock.getItem.mockReturnValue(JSON.stringify({ refreshToken: "r1" }));

        await (authApi as any).checkAuthentication();

        expect(get((authApi as any).authCheckComplete)).toBe(true);
    });

    it("Invalid access token in authentication check", async () => {
        localStorageMock.getItem.mockReturnValue(JSON.stringify({ accessToken: "acc" }));

        vi.spyOn(tokensModule as any, "isTokenValid").mockReturnValue(false);

        const authSetSpy = vi.spyOn((initialStore as any).isAuthenticated, "set").mockImplementation(() => undefined as any);

        await (authApi as any).checkAuthentication();

        expect(authSetSpy).toHaveBeenCalledWith(false);
        expect(get((authApi as any).authCheckComplete)).toBe(true);
    });

    it("Check authentication with valid token and existing currentUser", async () => {
        localStorageMock.getItem.mockReturnValue(JSON.stringify({ accessToken: "acc" }));

        vi.spyOn(tokensModule as any, "isTokenValid").mockReturnValue(true);
        
        const getSpy = vi.spyOn({ get }, 'get').mockReturnValue({ id: 7, name: "exists" });
        const getUserSpy = vi.spyOn(authApi as any, "getUserData").mockImplementation(() => Promise.resolve({}));
        const authSetSpy = vi.spyOn((initialStore as any).isAuthenticated, "set").mockImplementation(() => undefined as any);
        await (authApi as any).checkAuthentication();

        expect(getUserSpy).not.toHaveBeenCalled();
        expect(authSetSpy).toHaveBeenCalledWith(true);
        expect(get((authApi as any).authCheckComplete)).toBe(true);

        getSpy.mockRestore();
    });

    it("Sets currentUser when getUserData returns user", async () => {
        vi.resetModules();
        
        const userSetSpy = vi.fn();
        const authSetSpy = vi.fn();
        
        vi.doMock("$lib/utils/auth/storage/initial", () => ({
            currentUser: {
                subscribe: (run: (v: any) => void) => { run(null); return () => {}; },
                set: userSetSpy
            },
            isAuthenticated: {
                subscribe: (run: (v: any) => void) => { run(false); return () => {}; },
                set: authSetSpy
            },
        }));
        
        vi.doMock("$lib/utils/auth/tokens/tokens", () => ({
            getAuthTokens: vi.fn().mockReturnValue({ accessToken: "valid_token" }),
            clearAuthTokens: vi.fn(),
            isTokenValid: vi.fn().mockReturnValue(true),
        }));
        
        vi.doMock("$lib/utils/auth/tokens/storage", () => ({
            setTokenStore: vi.fn(),
        }));
        
        vi.doMock("$lib/utils/api", () => ({
            api: {
                post: vi.fn(),
                get: vi.fn().mockResolvedValue({ 
                    success: true, 
                    data: { id: 99, name: "TestUser" } 
                }),
            },
        }));
        
        vi.doMock("@fingerprintjs/fingerprintjs", () => ({
            default: { load: vi.fn() },
            load: vi.fn()
        }));
        
        localStorageMock.getItem.mockImplementation((key: string) => {
            if (key === 'auth_tokens') {
                return JSON.stringify({ accessToken: "valid_token" });
            }
            return null;
        });
        
        const freshAuthApi = await import("$lib/utils/auth/api/api");
        await freshAuthApi.checkAuthentication();
        
        expect(userSetSpy).toHaveBeenCalledWith({ id: 99, name: "TestUser" });
        expect(authSetSpy).toHaveBeenCalledWith(true);
    });

    it("Sets isAuthenticated to true when currentUser already exists", async () => {
        vi.resetModules();
        
        const userSetSpy = vi.fn();
        const authSetSpy = vi.fn();
        
        vi.doMock("svelte/store", () => ({
            writable: (initial: any) => ({
                subscribe: (run: (v: any) => void) => { run(initial); return () => {}; },
                set: vi.fn(),
                update: vi.fn()
            }),
            get: () => ({ id: 1, name: "ExistingUser" })
        }));
        
        vi.doMock("$lib/utils/auth/storage/initial", () => ({
            currentUser: {
                subscribe: (run: (v: any) => void) => { run({ id: 1, name: "ExistingUser" }); return () => {}; },
                set: userSetSpy
            },
            isAuthenticated: {
                subscribe: (run: (v: any) => void) => { run(false); return () => {}; },
                set: authSetSpy
            },
        }));
        
        vi.doMock("$lib/utils/auth/tokens/tokens", () => ({
            getAuthTokens: vi.fn().mockReturnValue({ accessToken: "valid_token" }),
            clearAuthTokens: vi.fn(),
            isTokenValid: vi.fn().mockReturnValue(true),
        }));
        
        vi.doMock("$lib/utils/auth/tokens/storage", () => ({
            setTokenStore: vi.fn(),
        }));
        
        vi.doMock("$lib/utils/api", () => ({
            api: {
                post: vi.fn(),
                get: vi.fn(),
            },
        }));
        
        vi.doMock("@fingerprintjs/fingerprintjs", () => ({
            default: { load: vi.fn() },
            load: vi.fn()
        }));
        
        localStorageMock.getItem.mockImplementation((key: string) => {
            if (key === 'auth_tokens') {
                return JSON.stringify({ accessToken: "valid_token" });
            }
            return null;
        });
        
        const freshAuthApi = await import("$lib/utils/auth/api/api");
        const getUserDataSpy = vi.spyOn(freshAuthApi, "getUserData");
        
        await freshAuthApi.checkAuthentication();
        
        expect(getUserDataSpy).not.toHaveBeenCalled();
        const trueCalls = authSetSpy.mock.calls.filter((call: any[]) => call[0] === true);
        expect(trueCalls.length).toBeGreaterThanOrEqual(2);
    });

    it("Returns immediately when authChecking is true", async () => {
        vi.resetModules();
        
        const authSetSpy = vi.fn();
        
        vi.doMock("svelte/store", () => ({
            writable: (initial: any) => ({
                subscribe: (run: (v: any) => void) => { run(initial); return () => {}; },
                set: vi.fn(),
                update: vi.fn()
            }),
            get: () => null
        }));
        
        vi.doMock("$lib/utils/auth/storage/initial", () => ({
            currentUser: {
                subscribe: (run: (v: any) => void) => { run(null); return () => {}; },
                set: vi.fn()
            },
            isAuthenticated: {
                subscribe: (run: (v: any) => void) => { run(false); return () => {}; },
                set: authSetSpy
            },
        }));
        
        vi.doMock("$lib/utils/auth/tokens/tokens", () => ({
            getAuthTokens: vi.fn().mockReturnValue({ accessToken: "valid_token" }),
            clearAuthTokens: vi.fn(),
            isTokenValid: vi.fn().mockReturnValue(true),
        }));
        
        vi.doMock("$lib/utils/auth/tokens/storage", () => ({
            setTokenStore: vi.fn(),
        }));
        
        let resolveGetUserData: (value: any) => void;
        const hangingPromise = new Promise((resolve) => {
            resolveGetUserData = resolve;
        });
        
        vi.doMock("$lib/utils/api", () => ({
            api: {
                post: vi.fn(),
                get: vi.fn().mockReturnValue(hangingPromise),
            },
        }));
        
        vi.doMock("@fingerprintjs/fingerprintjs", () => ({
            default: { load: vi.fn() },
            load: vi.fn()
        }));
        
        localStorageMock.getItem.mockImplementation((key: string) => {
            if (key === 'auth_tokens') {
                return JSON.stringify({ accessToken: "valid_token" });
            }
            return null;
        });
        
        const freshAuthApi = await import("$lib/utils/auth/api/api");
        const firstCall = freshAuthApi.checkAuthentication();
        await freshAuthApi.checkAuthentication();
        
        const trueCallsBeforeResolve = authSetSpy.mock.calls.filter((c: any[]) => c[0] === true).length;
        expect(trueCallsBeforeResolve).toBe(1);
        
        resolveGetUserData!({ success: true, data: { id: 1 } });
        await firstCall;
    });
});

describe('Finish registration function', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it("Finish registration successfully", async () => {
        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const apiModule = await import('$lib/utils/api');
        apiModule.api.post = vi.fn().mockResolvedValueOnce({
            success: true
        } as any);

        delete (globalThis as any).location;
        (globalThis as any).location = { href: "/somewhere" };

        const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation((fn, delay) => {
            if (typeof fn === "function") fn();
            return 1 as any;
        });

        const { finishRegistration } = await import("$lib/utils/auth/api/api");
        const result = await finishRegistration("Иван Петров", "ivan123", "password123", "token123");

        expect(apiModule.api.post).toHaveBeenCalledWith('/api/v1/auth/register', {
            name: "Иван Петров",
            login: "ivan123",
            password: "password123",
            token: "token123"
        });
        expect(notificationMock.notification).toHaveBeenCalledWith('Регистрация завершена!', notificationMock.NotificationType.Success);
        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1500);
        expect((globalThis as any).location.href).toBe("/");
        expect(result).toBe(true);

        setTimeoutSpy.mockRestore();
    });

    it("Finish registration with API error response", async () => {
        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const apiModule = await import('$lib/utils/api');
        apiModule.api.post = vi.fn().mockResolvedValueOnce({
            success: false
        } as any);

        const { finishRegistration } = await import("$lib/utils/auth/api/api");
        const result = await finishRegistration("Анна Смирнова", "anna456", "mypass456", "badtoken");

        expect(apiModule.api.post).toHaveBeenCalledWith('/api/v1/auth/register', {
            name: "Анна Смирнова",
            login: "anna456",
            password: "mypass456",
            token: "badtoken"
        });
        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка регистрации', notificationMock.NotificationType.Error);
        expect(result).toBe(false);
    });

    it("Finish registration with API exception", async () => {
        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const apiModule = await import('$lib/utils/api');
        apiModule.api.post = vi.fn().mockRejectedValueOnce(new Error("Network error"));

        const { finishRegistration } = await import("$lib/utils/auth/api/api");
        const result = await finishRegistration("Петр Козлов", "petr789", "secret789", "errortoken");

        expect(apiModule.api.post).toHaveBeenCalledWith('/api/v1/auth/register', {
            name: "Петр Козлов",
            login: "petr789",
            password: "secret789",
            token: "errortoken"
        });
        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка регистрации', notificationMock.NotificationType.Error);
        expect(result).toBe(false);
    });

    it("Finish registration does not redirect on failure", async () => {
        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const apiModule = await import('$lib/utils/api');
        apiModule.api.post = vi.fn().mockResolvedValueOnce({
            success: false
        } as any);

        delete (globalThis as any).location;
        (globalThis as any).location = { href: "/current-page" };

        const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

        const { finishRegistration } = await import("$lib/utils/auth/api/api");
        await finishRegistration("Мария Волкова", "maria000", "pass000", "failtoken");

        expect(setTimeoutSpy).not.toHaveBeenCalled();
        expect((globalThis as any).location.href).toBe("/current-page");

        setTimeoutSpy.mockRestore();
    });

    it("Finish registration with empty parameters", async () => {
        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const apiModule = await import('$lib/utils/api');
        apiModule.api.post = vi.fn().mockResolvedValueOnce({
            success: true
        } as any);

        const { finishRegistration } = await import("$lib/utils/auth/api/api");
        const result = await finishRegistration("", "", "", "");

        expect(apiModule.api.post).toHaveBeenCalledWith('/api/v1/auth/register', {
            name: "",
            login: "",
            password: "",
            token: ""
        });
        expect(result).toBe(true);
    });
    
    it("Returns immediately if no accessToken", () => {
        vi.doMock("$lib/utils/auth/tokens/tokens", () => ({
            getAuthTokens: () => undefined
        }));

        return import("$lib/utils/auth/api/api").then(apiModule => {
            const tryRefreshSpy = vi.spyOn(apiModule, "tryRefresh");
            apiModule.onVisibilityOrFocus();
            expect(tryRefreshSpy).not.toHaveBeenCalled();
        });
    });

    it("Calls else branch in onVisibilityOrFocus when accessToken is present", async () => {
        const payload = {};
        const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
        const mockAccessToken = `header.${base64Payload}.signature`;

        vi.doMock("$lib/utils/auth/tokens/tokens", () => ({
            getAuthTokens: () => ({ accessToken: mockAccessToken })
        }));

        const apiModule = await import("$lib/utils/auth/api/api");
        const tryRefreshSpy = vi.spyOn(apiModule, "tryRefresh");

        apiModule.onVisibilityOrFocus();

        expect(tryRefreshSpy).not.toHaveBeenCalled();
    });

    it("Calls Date.now() in onVisibilityOrFocus when accessToken and exp are present", async () => {
        const exp = Math.floor(Date.now() / 1000) + 10 * 60;
        const payload = { exp };
        const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
        const mockAccessToken = `header.${base64Payload}.signature`;

        vi.doMock("$lib/utils/auth/tokens/tokens", () => ({
            getAuthTokens: () => ({ accessToken: mockAccessToken })
        }));

        const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => 1234567890000);

        const apiModule = await import("$lib/utils/auth/api/api");
        // @ts-ignore
        const tryRefreshSpy = vi.spyOn(apiModule, "tryRefresh").mockImplementation(() => {});

        apiModule.onVisibilityOrFocus();

        expect(nowSpy).toHaveBeenCalled();
        expect(tryRefreshSpy).not.toHaveBeenCalled();

        nowSpy.mockRestore();
    });

    it("Call tryRefresh in onVisibilityOrFocus when token expires soon", async () => {
        vi.resetModules();

        const exp = Math.floor((Date.now() + 5 * 60 * 1000) / 1000);
        const payload = { exp };
        const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
        const mockAccessToken = `header.${base64Payload}.signature`;

        vi.doMock("$lib/utils/auth/tokens/tokens", () => ({
            getAuthTokens: () => ({ accessToken: mockAccessToken })
        }));

        const apiModule = await import("$lib/utils/auth/api/api");
        (apiModule as any).isRefreshing = true;

        expect(() => apiModule.onVisibilityOrFocus()).not.toThrow();
    });
});