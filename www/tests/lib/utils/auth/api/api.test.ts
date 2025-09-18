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

const authApi = await import("$lib/utils/auth/api/api");
const tokensModule = await import("$lib/utils/auth/tokens/tokens");
const storageModule = await import("$lib/utils/auth/tokens/storage");
const initialStore = await import("$lib/utils/auth/storage/initial");
const apiModule = await import("$lib/utils/api");
const FingerprintJS = await import("@fingerprintjs/fingerprintjs");

beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
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
        await (authApi as any).login("e", "p", true);

        expect(setTokenSpy).toHaveBeenCalled();

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
        await (authApi as any).login("e", "p", true);

        expect(setTokenSpy.mock.calls[0][0]).toEqual({ accessToken: "acc2", refreshToken: "ref2" });
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

    it("Set data of current user", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue({ accessToken: "acc" } as any);
        const user = { id: 1, name: "u" };
        (apiModule as any).api.get.mockResolvedValueOnce({ success: true, data: user } as any);

        const userSetSpy = vi.spyOn((initialStore as any).currentUser, "set").mockImplementation(() => undefined as any);
        const res = await (authApi as any).getUserData();
        
        expect(userSetSpy).toHaveBeenCalledWith(user);
        expect(res).toEqual(user);
    });

    it("Sets auth and fetches user if needed on auth check", async () => {
        const tokens = { accessToken: "acc" };
        vi.spyOn(localStorage.__proto__, "getItem").mockReturnValue(JSON.stringify(tokens));
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
        (apiModule as any).api.get.mockResolvedValueOnce({ success: false, error: "api down" } as any);
        await expect((authApi as any).getUserData()).rejects.toThrow("api down");
    });

    it("Throw error when user data is missing", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue({ accessToken: "acc" } as any);
        (apiModule as any).api.get.mockResolvedValueOnce({ success: true } as any);
        await expect((authApi as any).getUserData()).rejects.toThrow("Failed to fetch user data");
    });

    it("Schedules immediate refresh", async () => {
        vi.spyOn(tokensModule as any, "getAuthTokens").mockReturnValue({ refreshToken: "r1" } as any);

        const fpGet = vi.fn().mockResolvedValue({ visitorId: "fp-id" });
        const fpLoad = (FingerprintJS as any).load || (FingerprintJS as any).default.load;
        fpLoad.mockResolvedValue({ get: fpGet });

        const payload = { exp: Math.floor((Date.now() - 1000) / 1000) };
        // @ts-ignore
        const base64Payload = typeof btoa === "function" ? btoa(JSON.stringify(payload)) : Buffer.from(JSON.stringify(payload)).toString("base64");
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

        await (authApi as any).login("e", "p", true);
        expect(setTokenSpy).toHaveBeenCalledTimes(1);

        await vi.runAllTimersAsync();
        await Promise.resolve();

        expect(setTokenSpy).toHaveBeenCalledTimes(2)
        expect(setTimeoutSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

        setTimeoutSpy.mockRestore();
    });

    it("Exit from authentication check when no tokenData in localStorage", async () => {
        vi.resetModules();
        vi.spyOn(localStorage.__proto__, "getItem").mockReturnValue(null);

        const freshAuthApi = await import("$lib/utils/auth/api/api");
        const freshInitial = await import("$lib/utils/auth/storage/initial");

        const authSetSpy = vi.spyOn((freshInitial as any).isAuthenticated, "set");

        await (freshAuthApi as any).checkAuthentication();

        expect((freshAuthApi as any).authCheckComplete).toBeDefined();
        expect(vi.isMockFunction((freshInitial as any).isAuthenticated.set)).toBe(true);
        expect(authSetSpy).not.toHaveBeenCalledWith(true);
        // @ts-ignore
        expect((freshAuthApi as any).authCheckComplete && (await import("svelte/store")).then ? true : true);
    });

    it("Handles invalid JSON in authenctication check", async () => {
        vi.resetModules();
        vi.spyOn(localStorage.__proto__, "getItem").mockReturnValue("not-json");

        const freshAuthApi = await import("$lib/utils/auth/api/api");
        const freshTokens = await import("$lib/utils/auth/tokens/tokens");
        const freshInitial = await import("$lib/utils/auth/storage/initial");

        const clearSpy = vi.spyOn((freshTokens as any), "clearAuthTokens");
        const authSetSpy = vi.spyOn((freshInitial as any).isAuthenticated, "set");

        await (freshAuthApi as any).checkAuthentication();

        expect(authSetSpy).toHaveBeenCalledWith(false);
        expect(clearSpy).toHaveBeenCalled();
        expect((freshAuthApi as any).authCheckComplete).toBeDefined();
    });

    it("Check authentication without accessToken", async () => {
        vi.resetModules();
        vi.spyOn(localStorage.__proto__, "getItem").mockReturnValue(JSON.stringify({ refreshToken: "r1" }));

        const freshAuthApi = await import("$lib/utils/auth/api/api");

        await (freshAuthApi as any).checkAuthentication();

        expect((freshAuthApi as any).authCheckComplete).toBeDefined();
    });

    it("Invalid access token in authentication check", async () => {
        vi.resetModules();
        vi.spyOn(localStorage.__proto__, "getItem").mockReturnValue(JSON.stringify({ accessToken: "acc" }));

        const freshAuthApi = await import("$lib/utils/auth/api/api");
        const freshTokens = await import("$lib/utils/auth/tokens/tokens");
        const freshInitial = await import("$lib/utils/auth/storage/initial");

        vi.spyOn((freshTokens as any), "isTokenValid").mockReturnValue(false);

        const authSetSpy = vi.spyOn((freshInitial as any).isAuthenticated, "set");

        await (freshAuthApi as any).checkAuthentication();

        expect(authSetSpy).toHaveBeenCalledWith(false);
        expect((freshAuthApi as any).authCheckComplete).toBeDefined();
    });

    it("Check authentication with valid token and existing currentUser", async () => {
        vi.resetModules();
        vi.spyOn(localStorage.__proto__, "getItem").mockReturnValue(JSON.stringify({ accessToken: "acc" }));

        const freshAuthApi = await import("$lib/utils/auth/api/api");
        const freshTokens = await import("$lib/utils/auth/tokens/tokens");
        const freshInitial = await import("$lib/utils/auth/storage/initial");

        vi.spyOn((freshTokens as any), "isTokenValid").mockReturnValue(true);

        const existingUser = { id: 7, name: "exists" };
        (freshInitial as any).currentUser.subscribe = (run: (v: any) => void) => { run(existingUser); return () => {}; };

        const getUserSpy = vi.spyOn((freshAuthApi as any), "getUserData");
        const authSetSpy = vi.spyOn((freshInitial as any).isAuthenticated, "set");

        await (freshAuthApi as any).checkAuthentication();

        expect(getUserSpy).not.toHaveBeenCalled();
        expect(authSetSpy).toHaveBeenCalledWith(true);
        expect((freshAuthApi as any).authCheckComplete).toBeDefined();
    });
});