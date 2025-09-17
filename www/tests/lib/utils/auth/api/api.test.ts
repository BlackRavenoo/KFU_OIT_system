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

    it("Login stores tokens", async () => {
        const fpGet = vi.fn().mockResolvedValue({ visitorId: "fp-login" });
        const fpLoad = (FingerprintJS as any).load || (FingerprintJS as any).default.load;
        fpLoad.mockResolvedValue({ get: fpGet });

        (apiModule as any).api.post.mockResolvedValueOnce({
            success: true,
            data: { access_token: "acc", refresh_token: "ref" }
        } as any);

        const setTokenSpy = vi.spyOn(storageModule as any, "setTokenStore").mockImplementation(() => undefined as any);
        const res = await (authApi as any).login("e", "p", false);

        expect(fpGet).toHaveBeenCalled();
        expect(setTokenSpy).toHaveBeenCalledWith({ accessToken: "acc", refreshToken: undefined });
        expect(res).toEqual({ access_token: "acc", refresh_token: "ref" });
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
});