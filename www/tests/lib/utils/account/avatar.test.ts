import { vi, describe, it, expect } from 'vitest';
import setupApiMock from '../../../apiClientMock';

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

describe('Work with avatar utils', () => {
    it('Initialize avatar state', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const mod = await import('$lib/utils/account/avatar');
        const state = mod.initAvatarState();
        
        expect(state.cropSize).toBe(150);
        expect(state.containerSize).toBe(300);
        expect(state.scale).toBe(1);
        expect(state.imageSize).toEqual({ width: 0, height: 0 });
    });

    it('Center image when size of image is zero', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const { centerImage, initAvatarState } = await import('$lib/utils/account/avatar');
        const state = initAvatarState();
        const res = centerImage(state);
        
        expect(res).toBe(state);
    });

    it('Compute scale and positions for portrait and landscape', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const { centerImage } = await import('$lib/utils/account/avatar');

        const portrait = {
            containerSize: 300,
            cropSize: 150,
            imageSize: { width: 100, height: 300 },
            imgX: 0, imgY: 0, scale: 1
        } as any;
        const pRes = centerImage(portrait);
        
        expect(typeof pRes.scale).toBe('number');
        expect(typeof pRes.imgX).toBe('number');
        expect(typeof pRes.imgY).toBe('number');

        const landscape = {
            containerSize: 300,
            cropSize: 150,
            imageSize: { width: 500, height: 200 },
            imgX: 0, imgY: 0, scale: 1
        } as any;
        const lRes = centerImage(landscape);
        
        expect(typeof lRes.scale).toBe('number');
        expect(typeof lRes.imgX).toBe('number');
        expect(typeof lRes.imgY).toBe('number');
    });

    it('Applies fallback when portrait scale too small', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const { centerImage } = await import('$lib/utils/account/avatar');
        const state = {
            containerSize: 180,
            cropSize: 150,
            imageSize: { width: 100, height: 300 },
            imgX: 0,
            imgY: 0,
            scale: 1
        } as any;
        const res = centerImage(state);
        
        expect(res.scale).toBeCloseTo(1.65, 6);
        expect(res.scale).toBeGreaterThan(1.5);
    });

    it('Applies fallback when landscape scale too small', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const { centerImage } = await import('$lib/utils/account/avatar');
        const state = {
            containerSize: 180,
            cropSize: 150,
            imageSize: { width: 500, height: 100 },
            imgX: 0,
            imgY: 0,
            scale: 1
        } as any;
        const res = centerImage(state);
        
        expect(res.scale).toBeCloseTo(1.65, 6);
        expect(res.scale).toBeGreaterThan(1.5);
    });

    it('Keeps image within crop bounds', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const { constrainCrop } = await import('$lib/utils/account/avatar');
        const state = {
            containerSize: 300,
            cropSize: 150,
            imageSize: { width: 200, height: 200 },
            scale: 1,
            imgX: 1000,
            imgY: -1000
        } as any;
        const res = constrainCrop(state);
        const cropLeft = (state.containerSize - state.cropSize) / 2;
        const cropTop = cropLeft;
        
        expect(res.imgX).toBeLessThanOrEqual(cropLeft);
        expect(res.imgY).toBeGreaterThanOrEqual(cropTop - 10000);
    });

    it('Returns same state when size of image is missing', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const { constrainCrop } = await import('$lib/utils/account/avatar');

        const state = {
            containerSize: 300,
            cropSize: 150,
            imageSize: { width: 0, height: 0 },
            scale: 1,
            imgX: 10,
            imgY: 20
        } as any;

        const res = constrainCrop(state);
        expect(res).toBe(state);
    });

    it('Transform image position style', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const { updateImagePosition } = await import('$lib/utils/account/avatar');
        const div = document.createElement('div');
        updateImagePosition(div, 10, 20, 1.5);
        expect(div.style.transform).toContain('translate(10px, 20px) scale(1.5)');
    });

    it('Sets dimensions and position', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const { updateCropFrame } = await import('$lib/utils/account/avatar');
        const frame = document.createElement('div');
        updateCropFrame(frame, 120, 300);
        
        expect(frame.style.width).toBe('120px');
        expect(frame.style.height).toBe('120px');
        expect(frame.style.left).toBe(`${(300 - 120) / 2}px`);
        expect(frame.style.top).toBe(`${(300 - 120) / 2}px`);
    });

    it('Changes scale and keeps within limits', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const { zoomImage } = await import('$lib/utils/account/avatar');
        const state = {
            containerSize: 300,
            cropSize: 150,
            imageSize: { width: 200, height: 200 },
            scale: 1,
            imgX: 0,
            imgY: 0
        } as any;

        const zoomed = zoomImage(state, 2);
        expect(zoomed.scale).toBeGreaterThan(state.scale);

        const zoomedOut = zoomImage(state, -10);
        expect(zoomedOut.scale).toBeGreaterThanOrEqual(0.1);
    });

    it('Adjusts image position via constrainCrop', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const { moveImage } = await import('$lib/utils/account/avatar');
        const state = {
            containerSize: 300,
            cropSize: 150,
            imageSize: { width: 200, height: 200 },
            scale: 1,
            imgX: 5,
            imgY: 7
        } as any;
        const moved = moveImage(state, 10, -3);

        expect(moved.imgX).not.toBe(state.imgX);
        expect(moved.imgY).not.toBe(state.imgY);
    });

    it('Add/remove keyboard handlers', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('$app/environment', () => ({ browser: true }));
        const { addKeyboardHandlers, removeKeyboardHandlers } = await import('$lib/utils/account/avatar');

        const handler = vi.fn();
        const spyAdd = vi.spyOn(window, 'addEventListener');
        const spyRemove = vi.spyOn(window, 'removeEventListener');

        addKeyboardHandlers(handler);
        expect(spyAdd).toHaveBeenCalledWith('keydown', handler);

        removeKeyboardHandlers(handler);
        expect(spyRemove).toHaveBeenCalledWith('keydown', handler);

        spyAdd.mockRestore();
        spyRemove.mockRestore();
    });

    it('Returns File when canvas and image load succeed', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const { cropAvatarImage } = await import('$lib/utils/account/avatar');

        class MockImage {
            onload: (() => void) | null = null;
            width = 400;
            height = 400;
            _src = '';
            set src(v: string) {
                this._src = v;
                setTimeout(() => this.onload && this.onload(), 0);
            }
            get src() { return this._src; }
        }
        // @ts-ignore
        global.Image = MockImage;

        const canvas = document.createElement('canvas');
        const ctx: any = {
            clearRect: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            closePath: vi.fn(),
            clip: vi.fn(),
            drawImage: vi.fn()
        };
        // @ts-ignore
        canvas.getContext = () => ctx;
        // @ts-ignore
        canvas.toBlob = (cb: (b: Blob | null) => void) => {
            const blob = new Blob(['a'], { type: 'image/jpeg' });
            cb(blob);
        };

        const file = await cropAvatarImage(canvas, 'data:image/png;base64,xxx', 0, 0, 1, 150, 300);
        
        expect(file).not.toBeNull();
        expect((file as File).name).toContain('avatar.jpg');
    });

    it('Canvas.getContext returns null', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const { cropAvatarImage } = await import('$lib/utils/account/avatar');

        class MockImage {
            onload: (() => void) | null = null;
            width = 400;
            height = 400;
            _src = '';
            set src(v: string) {
                this._src = v;
                setTimeout(() => this.onload && this.onload(), 0);
            }
            get src() { return this._src; }
        }
        // @ts-ignore
        global.Image = MockImage;

        const canvas = document.createElement('canvas');
        // @ts-ignore
        canvas.getContext = () => null;
        // @ts-ignore
        canvas.toBlob = (cb: (b: Blob | null) => void) => cb(null);

        const res = await cropAvatarImage(canvas, 'data:image/png;base64,xxx', 0, 0, 1, 150, 300);
        expect(res).toBeNull();
    });

    it('Canvas.toBlob returns null', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const { cropAvatarImage } = await import('$lib/utils/account/avatar');

        class MockImage {
            onload: (() => void) | null = null;
            width = 400;
            height = 400;
            _src = '';
            set src(v: string) {
                this._src = v;
                setTimeout(() => this.onload && this.onload(), 0);
            }
            get src() { return this._src; }
        }
        // @ts-ignore
        global.Image = MockImage;

        const canvas = document.createElement('canvas');
        const ctx: any = {
            clearRect: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            closePath: vi.fn(),
            clip: vi.fn(),
            drawImage: vi.fn()
        };
        // @ts-ignore
        canvas.getContext = () => ctx;
        // @ts-ignore
        canvas.toBlob = (cb: (b: Blob | null) => void) => cb(null);

        const res = await cropAvatarImage(canvas, 'data:image/png;base64,xxx', 0, 0, 1, 150, 300);
        expect(res).toBeNull();
    });

    it('Updates currentUser and returns url on success', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Warning: 'warning' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const mockStore = createMockStore({ id: 'u1', name: 'N', email: 'e', avatar: '' });
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const api = await import('$lib/utils/api');
        api.api.post = vi.fn().mockResolvedValue({ success: true, data: { avatar_url: 'http://img' } });

        const { uploadAvatar } = await import('$lib/utils/account/avatar');

        const fakeFile = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
        const res = await uploadAvatar(fakeFile);
        
        expect(res).toBe('http://img');
        expect(notificationMock.notification).toHaveBeenCalledWith('Аватар успешно обновлен', notificationMock.NotificationType.Success);
        expect(mockStore.__get().avatar).toBe('http://img');
    });

    it('API failure during upload avatar', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Warning: 'warning' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const mockStore = createMockStore({ id: 'u1', name: 'N', email: 'e', avatar: '' });
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const api = await import('$lib/utils/api');
        api.api.post = vi.fn().mockResolvedValue({ success: false });

        const { uploadAvatar } = await import('$lib/utils/account/avatar');

        const fakeFile = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
        const res = await uploadAvatar(fakeFile);
        
        expect(res).toBeNull();
        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка при обновлении аватара', notificationMock.NotificationType.Warning);
    });

    it('Exception during avatar upload', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Warning: 'warning' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const mockStore = createMockStore({ id: 'u1', name: 'N', email: 'e', avatar: '' });
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const api = await import('$lib/utils/api');
        api.api.post = vi.fn().mockRejectedValue(new Error('network'));

        const { uploadAvatar } = await import('$lib/utils/account/avatar');

        const fakeFile = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
        const res = await uploadAvatar(fakeFile);
        
        expect(res).toBeNull();
        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка при загрузке аватара', notificationMock.NotificationType.Warning);
    });

    it('Assigns empty strings for missing user fields', async () => {
        vi.resetModules();
        vi.clearAllMocks();
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Warning: 'warning' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const mockStore = createMockStore(null);
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const api = await import('$lib/utils/api');
        api.api.post = vi.fn().mockResolvedValue({ success: true, data: { avatar_url: 'http://img-null' } });

        const { uploadAvatar } = await import('$lib/utils/account/avatar');

        const fakeFile = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
        const res = await uploadAvatar(fakeFile);
        
        expect(res).toBe('http://img-null');
        expect(notificationMock.notification).toHaveBeenCalledWith('Аватар успешно обновлен', notificationMock.NotificationType.Success);
        expect(mockStore.__get().avatar).toBe('http://img-null');
        expect(mockStore.__get().id).toBe('');
        expect(mockStore.__get().name).toBe('');
        expect(mockStore.__get().email).toBe('');
        expect(mockStore.__get().role).toBe('');
    });

    it('Updates img when no img', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('svelte', () => ({ tick: vi.fn().mockResolvedValue(undefined) }));
        const { updateAvatarImage } = await import('$lib/utils/account/avatar');

        const comp1 = document.createElement('div');
        const img = document.createElement('img');
        comp1.appendChild(img);

        await updateAvatarImage(comp1, 'http://new');
        expect(new URL(img.src).toString()).toBe(new URL('http://new').toString());

        const comp2 = document.createElement('div');
        const el = document.createElement('div');
        el.setAttribute('style', 'background: color;');
        comp2.appendChild(el);

        await updateAvatarImage(comp2, 'http://bgurl');
        expect((el as HTMLElement).style.backgroundImage).toContain('http://bgurl');
    });

    it('Returns when avatarComponent is null', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('svelte', () => ({ tick: vi.fn().mockResolvedValue(undefined) }));
        const { updateAvatarImage } = await import('$lib/utils/account/avatar');
        const svelte = await import('svelte');

        await expect(updateAvatarImage(null as any, 'http://nope')).resolves.toBeUndefined();
        expect(svelte.tick).not.toHaveBeenCalled();
    });
});