import { vi, describe, it, expect } from 'vitest';
import setupApiMock from '../../../apiClientMock';
import { get } from 'svelte/store';
import { currentUser } from '$lib/utils/auth/storage/initial';

function createMockStore(initial: any) {
    let value = initial;
    const subs = new Set<Function>();
    return {
        subscribe(fn: Function) {
            fn(value);
            subs.add(fn);
            return () => subs.delete(fn);
        },
        set(v: any) {
            value = v;
            for (const s of subs) s(value);
        },
        update(updater: Function) {
            value = updater(value);
            for (const s of subs) s(value);
        },
        __get() { return value; }
    };
}

describe('Profile data for user account', () => {
    it('Update user profile with empty data', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');

        const mockStore = createMockStore(null);
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const { updateUserProfile } = await import('$lib/utils/account/profile');
        const res = await updateUserProfile();
        expect(res).toBe(true);
        expect(api.api.put).not.toHaveBeenCalled();
    });

    it('Update user profile with valid data', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockResolvedValue({ success: true });

        const initialUser = { id: 'u1', name: 'Old', email: 'old@example.com' };
        const mockStore = createMockStore(initialUser);
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const { updateUserProfile } = await import('$lib/utils/account/profile');
        const res = await updateUserProfile('New Name', 'new@example.com');

        expect(res).toBe(true);
        expect(get(mockStore)).toEqual(expect.objectContaining({ name: 'New Name', email: 'new@example.com' }));
    });

    it('API failure during profile update', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockResolvedValue({ success: false });

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: vi.fn().mockImplementation(() => { throw new Error('not found'); }) }));

        const { updateUserProfile } = await import('$lib/utils/account/profile');
        const res = await updateUserProfile('X', 'x@example.com');

        expect(res).toBe(false);
        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка при обновлении профиля', notificationMock.NotificationType.Error);
    });

    it('Catch API failure during profile update', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockRejectedValue(new Error('fail'));

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const mockStore = createMockStore({ id: 'u1', name: 'Old', email: 'old@example.com' });
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const { updateUserProfile } = await import('$lib/utils/account/profile');
        const res = await updateUserProfile('X', 'x@example.com');

        expect(res).toBe(false);
        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка при обновлении профиля', notificationMock.NotificationType.Error);
    });

    it('API succeeds but currentUser is missing', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const mockStore = {
            subscribe: (run: Function) => { run(null); return () => {}; },
            set: vi.fn(),
            update: vi.fn()
        };
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockResolvedValue({ success: true });

        const { updateUserProfile } = await import('$lib/utils/account/profile');
        const res = await updateUserProfile('Name', 'email@example.com');

        expect(res).toBe(false);
        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка при обновлении профиля', notificationMock.NotificationType.Error);
    });

    it('Update user password', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockResolvedValue({ success: true });

        const { updateUserPassword } = await import('$lib/utils/account/profile');
        const res = await updateUserPassword('cur', 'newp');

        expect(api.api.put).toHaveBeenCalledWith('/api/v1/user/password', { current_password: 'cur', new_password: 'newp' });
        expect(res).toBe(true);
    });

    it('Update user password with invalid data', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockResolvedValue({ success: false });

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const { updateUserPassword } = await import('$lib/utils/account/profile');
        const res1 = await updateUserPassword('cur', 'newp');
        expect(res1).toBe(false);
        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка при смене пароля', notificationMock.NotificationType.Error);

        api.api.put = vi.fn().mockRejectedValue(new Error('fail'));
        const res2 = await updateUserPassword('cur', 'newp');
        expect(res2).toBe(false);
    });

    it('Save user profile with invalid email', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const mockStore = createMockStore({ id: 'u1', name: 'Name', email: 'a@b.com' });
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const { saveUserProfile } = await import('$lib/utils/account/profile');
        const res = await saveUserProfile('Name', 'bad-email', 'login', false, '', '');
        expect(res).toBe(false);
        expect(notificationMock.notification).toHaveBeenCalledWith('Некорректный формат email', notificationMock.NotificationType.Error);
    });

    it('Save user profile with unchanged data', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const mockStore = createMockStore({ id: 'u1', name: 'Same', email: 'same@example.com', login: 'login' });
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const { saveUserProfile } = await import('$lib/utils/account/profile');
        const res = await saveUserProfile('Same', 'same@example.com', 'login', false, '', '');
        expect(res).toBe(true);
    });

    it('Save user profile with valid data', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockImplementation((endpoint: string) => {
            if (endpoint === '/api/v1/user/profile') return Promise.resolve({ success: true });
            if (endpoint === '/api/v1/user/password') return Promise.resolve({ success: true });
            return Promise.resolve({ success: false });
        });

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const mockStore = createMockStore({ id: 'u1', name: 'Old', email: 'old@example.com', login: 'oldLogin' });
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const { saveUserProfile } = await import('$lib/utils/account/profile');
        const res = await saveUserProfile('NewName', 'new@example.com', 'login', false, '', '');
        expect(res).toBe(true);
        expect(notificationMock.notification).toHaveBeenCalledWith('Профиль успешно обновлен', notificationMock.NotificationType.Success);
        expect(get(mockStore)).toEqual(expect.objectContaining({ name: 'NewName', email: 'new@example.com' }));
    });

    it('Save user profile with invalid password', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockImplementation((endpoint: string) => {
            if (endpoint === '/api/v1/user/profile') return Promise.resolve({ success: true });
            if (endpoint === '/api/v1/user/password') return Promise.resolve({ success: false });
            return Promise.resolve({ success: false });
        });

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const mockStore = createMockStore({ id: 'u1', name: 'Old', email: 'old@example.com', login: 'oldLogin' });
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const { saveUserProfile } = await import('$lib/utils/account/profile');
        const res = await saveUserProfile('NewName', 'new@example.com', 'login', true, 'cur', 'newp');
        expect(res).toBe(false);
        expect(notificationMock.notification).not.toHaveBeenCalledWith('Профиль успешно обновлен', notificationMock.NotificationType.Success);
    });

    it('Save user profile without old password', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockImplementation((endpoint: string) => {
            if (endpoint === '/api/v1/user/profile') return Promise.resolve({ success: true });
            if (endpoint === '/api/v1/user/password') return Promise.resolve({ success: false });
            return Promise.resolve({ success: false });
        });

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const mockStore = createMockStore({ id: 'u1', name: 'Old', email: 'old@example.com', login: 'oldLogin' });
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const { saveUserProfile } = await import('$lib/utils/account/profile');
        const res = await saveUserProfile('NewName', 'new@example.com', 'login', true, '', 'test');
        expect(res).toBe(false);
        expect(notificationMock.notification).toHaveBeenCalledWith('Введите текущий пароль', notificationMock.NotificationType.Error);
    });

    it('Save user profile without new password', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockImplementation((endpoint: string) => {
            if (endpoint === '/api/v1/user/profile') return Promise.resolve({ success: true });
            if (endpoint === '/api/v1/user/password') return Promise.resolve({ success: false });
            return Promise.resolve({ success: false });
        });

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const mockStore = createMockStore({ id: 'u1', name: 'Old', email: 'old@example.com', login: 'oldLogin' });
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const { saveUserProfile } = await import('$lib/utils/account/profile');
        const res = await saveUserProfile('NewName', 'new@example.com', 'login', true, 'test', '');
        expect(res).toBe(false);
        expect(notificationMock.notification).toHaveBeenCalledWith('Введите новый пароль', notificationMock.NotificationType.Error);
    });

    it('Save user profile without current data', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockImplementation((endpoint: string) => {
            if (endpoint === '/api/v1/user/profile') return Promise.resolve({ success: true });
            if (endpoint === '/api/v1/user/password') return Promise.resolve({ success: false });
            return Promise.resolve({ success: false });
        });

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);
        
        const mockStore = createMockStore({ id: 'u1', name: null, email: null, login: null });
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const { saveUserProfile } = await import('$lib/utils/account/profile');
        const res = await saveUserProfile('NewName', 'new@example.com', 'login', false, '', '');
        expect(res).toBe(true);
    });

    it('Save user profile with current name', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockResolvedValue({ success: true });

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);
        
        const mockStore = createMockStore({ id: 'u1', name: 'Test', email: 'x@example.com', login: 'login' });
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const { saveUserProfile } = await import('$lib/utils/account/profile');
        const res = await saveUserProfile('Test', 'new@example.com', 'login', false, '', '');
        expect(res).toBe(true);
        expect(api.api.put).toHaveBeenCalledWith('/api/v1/user/profile', { email: 'new@example.com' });
    });

    it('Save user profile with current email', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockResolvedValue({ success: true });

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);
        
        const mockStore = createMockStore({ id: 'u1', name: 'Test', email: 'x@example.com', login: 'login' });
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const { saveUserProfile } = await import('$lib/utils/account/profile');
        const res = await saveUserProfile('NewName', 'x@example.com', 'login', false, '', '');
        expect(res).toBe(true);
        expect(api.api.put).toHaveBeenCalledWith('/api/v1/user/profile', { name: 'NewName' });
    });

    it('Save only password', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockResolvedValue({ success: true });

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);
        
        const mockStore = createMockStore({ id: 'u1', name: 'Test', email: 'x@example.com', login: 'login' });
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const { saveUserProfile } = await import('$lib/utils/account/profile');
        const res = await saveUserProfile('Test', 'x@example.com', 'login', true, 'oldPSWD', 'newPSWD');
        expect(res).toBe(true);
        expect(api.api.put).toHaveBeenCalledWith('/api/v1/user/password', { current_password: 'oldPSWD', new_password: 'newPSWD' });
    });

    it('Updates localStorage cache when profile update succeeds', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();
    
        const localStorageMock = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn()
        };
        Object.defineProperty(global, 'localStorage', { value: localStorageMock });
    
        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockResolvedValue({ success: true });
    
        const initialUser = { id: 'u1', name: 'Old', email: 'old@example.com', login: 'oldLogin' };
        const mockStore = createMockStore(initialUser);
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));
    
        const cachedData = {
            timestamp: Date.now() - 5000,
            data: initialUser
        };
        localStorageMock.getItem.mockReturnValue(JSON.stringify(cachedData));
    
        const { updateUserProfile } = await import('$lib/utils/account/profile');
        const res = await updateUserProfile('New Name', 'new@example.com', 'newLogin');
    
        expect(res).toBe(true);
        expect(localStorageMock.getItem).toHaveBeenCalledWith('user_data_cache');
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'user_data_cache',
            expect.stringContaining('"name":"New Name"')
        );
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'user_data_cache',
            expect.stringContaining('"email":"new@example.com"')
        );
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'user_data_cache',
            expect.stringContaining('"login":"newLogin"')
        );
    });
    
    it('Updates cache timestamp when profile update succeeds', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();
    
        const localStorageMock = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn()
        };
        Object.defineProperty(global, 'localStorage', { value: localStorageMock });
    
        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockResolvedValue({ success: true });
    
        const initialUser = { id: 'u1', name: 'Old', email: 'old@example.com' };
        const mockStore = createMockStore(initialUser);
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));
    
        const oldTimestamp = Date.now() - 10000;
        const cachedData = {
            timestamp: oldTimestamp,
            data: initialUser
        };
        localStorageMock.getItem.mockReturnValue(JSON.stringify(cachedData));
    
        const mockNow = Date.now() + 1000;
        vi.spyOn(Date, 'now').mockReturnValue(mockNow);
    
        const { updateUserProfile } = await import('$lib/utils/account/profile');
        await updateUserProfile('New Name');
    
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'user_data_cache',
            expect.stringContaining(`"timestamp":${mockNow}`)
        );
    });
    
    it('Removes cache when no cached data exists during profile update', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();
    
        const localStorageMock = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn()
        };
        Object.defineProperty(global, 'localStorage', { value: localStorageMock });
    
        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockResolvedValue({ success: true });
    
        const initialUser = { id: 'u1', name: 'Old', email: 'old@example.com' };
        const mockStore = createMockStore(initialUser);
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));
    
        localStorageMock.getItem.mockReturnValue(null);
    
        const { updateUserProfile } = await import('$lib/utils/account/profile');
        await updateUserProfile('New Name');
    
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('user_data_cache');
    });
    
    it('Removes cache when cached data has no data property', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();
        
        const localStorageMock = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn()
        };
        Object.defineProperty(global, 'localStorage', { value: localStorageMock });

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockResolvedValue({ success: true });

        const initialUser = { id: 'u1', name: 'Old', email: 'old@example.com' };
        const mockStore = createMockStore(initialUser);
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const invalidCachedData = {
            timestamp: Date.now() - 5000
        };
        localStorageMock.getItem.mockReturnValue(JSON.stringify(invalidCachedData));

        const { updateUserProfile } = await import('$lib/utils/account/profile');
        await updateUserProfile('New Name');

        expect(localStorageMock.getItem).toHaveBeenCalledWith('user_data_cache');
        expect(localStorageMock.setItem).not.toHaveBeenCalled();
        expect(localStorageMock.removeItem).not.toHaveBeenCalled();
    });
    
    it('Removes cache when JSON.parse fails during cache update', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();
    
        const localStorageMock = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn()
        };
        Object.defineProperty(global, 'localStorage', { value: localStorageMock });
    
        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockResolvedValue({ success: true });
    
        const initialUser = { id: 'u1', name: 'Old', email: 'old@example.com' };
        const mockStore = createMockStore(initialUser);
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));
    
        localStorageMock.getItem.mockReturnValue('invalid-json');
    
        const { updateUserProfile } = await import('$lib/utils/account/profile');
        await updateUserProfile('New Name');
    
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('user_data_cache');
    });
    
    it('Removes cache when localStorage.setItem fails', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();
    
        const localStorageMock = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn()
        };
        Object.defineProperty(global, 'localStorage', { value: localStorageMock });
    
        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockResolvedValue({ success: true });
    
        const initialUser = { id: 'u1', name: 'Old', email: 'old@example.com' };
        const mockStore = createMockStore(initialUser);
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));
    
        const cachedData = {
            timestamp: Date.now() - 5000,
            data: initialUser
        };
        localStorageMock.getItem.mockReturnValue(JSON.stringify(cachedData));
        localStorageMock.setItem.mockImplementation(() => {
            throw new Error('LocalStorage quota exceeded');
        });
    
        const { updateUserProfile } = await import('$lib/utils/account/profile');
        const res = await updateUserProfile('New Name');
    
        expect(res).toBe(true);
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('user_data_cache');
    });
    
    it('Does not update cache when profile update fails', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();
    
        const localStorageMock = {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn()
        };
        Object.defineProperty(global, 'localStorage', { value: localStorageMock });
    
        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockResolvedValue({ success: false });
    
        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Error: 'error' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);
    
        const initialUser = { id: 'u1', name: 'Old', email: 'old@example.com' };
        const mockStore = createMockStore(initialUser);
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));
    
        const { updateUserProfile } = await import('$lib/utils/account/profile');
        const res = await updateUserProfile('New Name');
    
        expect(res).toBe(false);
        expect(localStorageMock.getItem).not.toHaveBeenCalled();
        expect(localStorageMock.setItem).not.toHaveBeenCalled();
        expect(localStorageMock.removeItem).not.toHaveBeenCalled();
});
});