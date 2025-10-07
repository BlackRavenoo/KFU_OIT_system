import { describe, it, expect } from "vitest";
import { UserRole, type ILoginRequest, type IAuthTokens, type IUserData, type ITokenStorage, type IAuthStore, type IAuthApiEndpoints } from "$lib/utils/auth/types";

describe("UserRole enum", () => {
    it("Should have correct values for UserRole enum", () => {
        expect(UserRole.Programmer).toBe("employee");
        expect(UserRole.Moderator).toBe("moderator");
        expect(UserRole.Administrator).toBe("admin");
    });

    it("Should have all expected enum keys", () => {
        const roleKeys = Object.keys(UserRole);
        expect(roleKeys).toContain("Programmer");
        expect(roleKeys).toContain("Moderator");
        expect(roleKeys).toContain("Administrator");
        expect(roleKeys).toHaveLength(3);
    });

    it("Should have all expected enum values", () => {
        const roleValues = Object.values(UserRole);
        expect(roleValues).toContain("employee");
        expect(roleValues).toContain("moderator");
        expect(roleValues).toContain("admin");
        expect(roleValues).toHaveLength(3);
    });
});

describe("Auth interface type compatibility", () => {
    it("Should accept valid ILoginRequest object", () => {
        const loginRequest: ILoginRequest = {
            login: "test@example.com",
            password: "password123",
            fingerprint: "fp123456"
        };

        expect(loginRequest.login).toBe("test@example.com");
        expect(loginRequest.password).toBe("password123");
        expect(loginRequest.fingerprint).toBe("fp123456");
    });

    it("Should accept valid IAuthTokens object with both tokens", () => {
        const authTokens: IAuthTokens = {
            accessToken: "access123",
            refreshToken: "refresh456"
        };

        expect(authTokens.accessToken).toBe("access123");
        expect(authTokens.refreshToken).toBe("refresh456");
    });

    it("Should accept valid IAuthTokens object without refresh token", () => {
        const authTokens: IAuthTokens = {
            accessToken: "access123"
        };

        expect(authTokens.accessToken).toBe("access123");
        expect(authTokens.refreshToken).toBeUndefined();
    });

    it("Should accept valid IUserData object", () => {
        const userData: IUserData = {
            id: "user123",
            name: "John Doe",
            email: "john@example.com",
            login: 'user',
            role: "admin"
        };

        expect(userData.id).toBe("user123");
        expect(userData.name).toBe("John Doe");
        expect(userData.email).toBe("john@example.com");
        expect(userData.role).toBe("admin");
    });

    it("Should accept valid IUserData object with UserRole enum", () => {
        const userData: IUserData = {
            id: "user456",
            name: "Jane Smith",
            email: "jane@example.com",
            role: UserRole.Moderator
        };

        expect(userData.role).toBe("moderator");
    });

    it("Should accept valid IAuthApiEndpoints object", () => {
        const endpoints: IAuthApiEndpoints = {
            login: "/api/auth/login",
            logout: "/api/auth/logout",
            refresh: "/api/auth/refresh",
            getUserData: "/api/auth/user"
        };

        expect(endpoints.login).toBe("/api/auth/login");
        expect(endpoints.logout).toBe("/api/auth/logout");
        expect(endpoints.refresh).toBe("/api/auth/refresh");
        expect(endpoints.getUserData).toBe("/api/auth/user");
    });
});

describe("Auth interface method signatures", () => {
    it("Should accept valid ITokenStorage implementation", () => {
        const mockStorage: ITokenStorage = {
            get: () => ({ accessToken: "test", refreshToken: "test" }),
            set: (tokens) => {},
            clear: () => {}
        };

        expect(typeof mockStorage.get).toBe("function");
        expect(typeof mockStorage.set).toBe("function");
        expect(typeof mockStorage.clear).toBe("function");

        const result = mockStorage.get();
        expect(result).toEqual({ accessToken: "test", refreshToken: "test" });
    });

    it("Should accept ITokenStorage implementation that returns null", () => {
        const mockStorage: ITokenStorage = {
            get: () => null,
            set: (tokens) => {},
            clear: () => {}
        };

        const result = mockStorage.get();
        expect(result).toBeNull();
    });

    it("Should accept valid IAuthStore implementation", () => {
        const mockStore: IAuthStore = {
            get: (name) => name === "test" ? "value" : null,
            set: (name, value) => {},
            clear: (name) => {}
        };

        expect(typeof mockStore.get).toBe("function");
        expect(typeof mockStore.set).toBe("function");
        expect(typeof mockStore.clear).toBe("function");

        expect(mockStore.get("test")).toBe("value");
        expect(mockStore.get("unknown")).toBeNull();
    });
});

describe("Auth type flexibility", () => {
    it("Should allow undefined refreshToken in IAuthTokens", () => {
        const tokens: IAuthTokens = {
            accessToken: "access123",
            refreshToken: undefined
        };

        expect(tokens.refreshToken).toBeUndefined();
    });

    it("Should work with different UserRole enum values", () => {
        const users: IUserData[] = [
            { id: "1", name: "User 1", email: "user1@test.com", login: 'user1', role: UserRole.Programmer },
            { id: "2", name: "User 2", email: "user2@test.com", login: 'user2', role: UserRole.Moderator },
            { id: "3", name: "User 3", email: "user3@test.com", login: 'user3', role: UserRole.Administrator }
        ];

        expect(users[0].role).toBe("employee");
        expect(users[1].role).toBe("moderator");
        expect(users[2].role).toBe("admin");
    });

    it("Should allow ITokenStorage to work with null values", () => {
        const storage: ITokenStorage = {
            get: () => null,
            set: (tokens) => {
                expect(tokens).toBeNull();
            },
            clear: () => {}
        };

        storage.set(null);
        expect(storage.get()).toBeNull();
    });
});

describe("Auth types required properties validation", () => {
    it("Should require all ILoginRequest properties", () => {
        const validRequest: ILoginRequest = {
            login: "test",
            password: "pass",
            fingerprint: "fp"
        };

        expect(validRequest).toHaveProperty("login");
        expect(validRequest).toHaveProperty("password");
        expect(validRequest).toHaveProperty("fingerprint");
    });

    it("Should require accessToken in IAuthTokens", () => {
        const validTokens: IAuthTokens = {
            accessToken: "required"
        };

        expect(validTokens).toHaveProperty("accessToken");
    });

    it("Should require all IUserData properties", () => {
        const validUser: IUserData = {
            id: "1",
            name: "Test",
            email: "test@test.com",
            login: 'test',
            role: "employee"
        };

        expect(validUser).toHaveProperty("id");
        expect(validUser).toHaveProperty("name");
        expect(validUser).toHaveProperty("login");
        expect(validUser).toHaveProperty("email");
        expect(validUser).toHaveProperty("role");
    });

    it("Should require all IAuthApiEndpoints properties", () => {
        const validEndpoints: IAuthApiEndpoints = {
            login: "/login",
            logout: "/logout",
            refresh: "/refresh",
            getUserData: "/user"
        };

        expect(validEndpoints).toHaveProperty("login");
        expect(validEndpoints).toHaveProperty("logout");
        expect(validEndpoints).toHaveProperty("refresh");
        expect(validEndpoints).toHaveProperty("getUserData");
    });
});