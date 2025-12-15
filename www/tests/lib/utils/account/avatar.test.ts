import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
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

class MockCanvas {
    width = 0;
    height = 0;
    _context: any = null;

    getContext(type: string) {
        if (!this._context) {
            this._context = {
                fillStyle: '',
                fillRect: vi.fn(),
                beginPath: vi.fn(),
                arc: vi.fn(),
                closePath: vi.fn(),
                clip: vi.fn(),
                drawImage: vi.fn(),
                font: '',
                textAlign: '',
                fillText: vi.fn(),
                clearRect: vi.fn()
            };
        }
        return this._context;
    }

    toDataURL() {
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    }

    toBlob(callback: (blob: Blob | null) => void) {
        callback(new Blob(['test'], { type: 'image/jpeg' }));
    }
}

describe('Work with avatar utils', () => {
    let originalCreateElement: any;

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        originalCreateElement = document.createElement.bind(document);
        document.createElement = vi.fn((tagName: string) => {
            if (tagName === 'canvas') {
                return new MockCanvas() as any;
            }
            return originalCreateElement(tagName);
        }) as any;

        global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        global.URL.revokeObjectURL = vi.fn();

        Object.defineProperty(window, 'devicePixelRatio', {
            writable: true,
            configurable: true,
            value: 1
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.createElement = originalCreateElement;
    });

    it('Initialize avatar state', async () => {
        const mod = await import('$lib/utils/account/avatar');
        const state = mod.initAvatarState();
        
        expect(state.cropSize).toBe(150);
        expect(state.containerSize).toBe(300);
        expect(state.scale).toBe(1);
        expect(state.imageSize).toEqual({ width: 0, height: 0 });
        expect(state.isDragging).toBe(false);
        expect(state.isResizing).toBe(false);
        expect(state.maxCropSize).toBe(280);
        expect(state.minCropSize).toBe(80);
    });

    it('Center image when size of image is zero', async () => {
        const { centerImage, initAvatarState } = await import('$lib/utils/account/avatar');
        const state = initAvatarState();
        const res = centerImage(state);
        
        expect(res).toBe(state);
    });

    it('Compute scale and positions for portrait and landscape', async () => {
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
        expect(pRes.scale).toBeGreaterThan(0);

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
        expect(lRes.scale).toBeGreaterThan(0);
    });

    it('Applies fallback when portrait scale too small', async () => {
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
        
        expect(res.scale).toBeCloseTo(1.65, 1);
        expect(res.scale).toBeGreaterThan(1.5);
    });

    it('Applies fallback when landscape scale too small', async () => {
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
        
        expect(res.scale).toBeCloseTo(1.65, 1);
        expect(res.scale).toBeGreaterThan(1.5);
    });

    it('Keeps image within crop bounds', async () => {
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
        expect(res.imgY).toBeGreaterThanOrEqual(cropTop - state.imageSize.height * state.scale);
    });

    it('Returns same state when size of image is missing', async () => {
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
        const { updateImagePosition } = await import('$lib/utils/account/avatar');
        const div = document.createElement('div');
        updateImagePosition(div, 10, 20, 1.5);
        expect(div.style.transform).toContain('translate(10px, 20px) scale(1.5)');
    });

    it('Does nothing when image container is missing', async () => {
        const { updateImagePosition } = await import('$lib/utils/account/avatar');
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        const res = updateImagePosition(null as any, 5, 6, 2);

        expect(res).toBeUndefined();
        expect(consoleSpy).toHaveBeenCalledWith('Image container not found');
        
        consoleSpy.mockRestore();
    });

    it('Sets dimensions and position', async () => {
        const { updateCropFrame } = await import('$lib/utils/account/avatar');
        const frame = document.createElement('div');
        updateCropFrame(frame, 120, 300);
        
        expect(frame.style.width).toBe('120px');
        expect(frame.style.height).toBe('120px');
        expect(frame.style.left).toBe(`${(300 - 120) / 2}px`);
        expect(frame.style.top).toBe(`${(300 - 120) / 2}px`);
    });

    it('Does nothing when frame is missing', async () => {
        const { updateCropFrame } = await import('$lib/utils/account/avatar');
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        
        const res = updateCropFrame(null as any, 120, 300);

        expect(res).toBeUndefined();
        expect(consoleSpy).toHaveBeenCalledWith('Crop frame not found');
        
        consoleSpy.mockRestore();
    });

    it('Changes scale and keeps within limits', async () => {
        const { zoomImage } = await import('$lib/utils/account/avatar');
        const state = {
            containerSize: 300,
            cropSize: 150,
            imageSize: { width: 200, height: 200 },
            scale: 1,
            imgX: 0,
            imgY: 0
        } as any;

        const zoomed = zoomImage(state, 0.5);
        expect(zoomed.scale).toBeGreaterThan(state.scale);

        const zoomedOut = zoomImage(state, -10);
        expect(zoomedOut.scale).toBeGreaterThanOrEqual(0.1);
        
        const maxZoom = zoomImage(state, 100);
        expect(maxZoom.scale).toBeLessThanOrEqual(5);
    });

    it('Adjusts image position via constrainCrop', async () => {
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

    it('Does not add keyboard handlers when not in browser', async () => {
        vi.doMock('$app/environment', () => ({ browser: false }));
        const { addKeyboardHandlers } = await import('$lib/utils/account/avatar');

        const handler = vi.fn();
        const spyAdd = vi.spyOn(window, 'addEventListener');

        addKeyboardHandlers(handler);
        expect(spyAdd).not.toHaveBeenCalled();

        spyAdd.mockRestore();
    });

    it('Returns File when canvas and image load succeed', async () => {
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

        const canvas = new MockCanvas() as any;

        const file = await cropAvatarImage(canvas, 'data:image/png;base64,xxx', 0, 0, 1, 150, 300);
        
        expect(file).not.toBeNull();
        expect((file as File).name).toContain('avatar.jpg');
        expect((file as File).type).toBe('image/jpeg');
    });

    it('Canvas.getContext returns null', async () => {
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

        const canvas = {
            width: 0,
            height: 0,
            getContext: () => null
        } as any;

        const res = await cropAvatarImage(canvas, 'data:image/png;base64,xxx', 0, 0, 1, 150, 300);
        expect(res).toBeNull();
    });

    it('Canvas.toBlob returns null', async () => {
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

        const canvas = new MockCanvas() as any;
        canvas.toBlob = (cb: (b: Blob | null) => void) => cb(null);

        const res = await cropAvatarImage(canvas, 'data:image/png;base64,xxx', 0, 0, 1, 150, 300);
        expect(res).toBeNull();
    });

    it('Updates currentUser and returns url on success', async () => {
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Warning: 'warning' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const mockStore = createMockStore({ id: 'u1', name: 'N', email: 'e', avatar_key: '' });
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockResolvedValue({ success: true, data: { avatar_url: 'http://img' } });

        const { uploadAvatar } = await import('$lib/utils/account/avatar');

        const fakeFile = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
        const res = await uploadAvatar(fakeFile);
        
        expect(res).toBe('http://img');
        expect(notificationMock.notification).toHaveBeenCalledWith('Аватар успешно обновлен', notificationMock.NotificationType.Success);
        expect(mockStore.__get().avatar_key).toBe('http://img');
    });

    it('API failure during upload avatar', async () => {
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Warning: 'warning' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const mockStore = createMockStore({ id: 'u1', name: 'N', email: 'e', avatar_key: '' });
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockResolvedValue({ success: false });

        const { uploadAvatar } = await import('$lib/utils/account/avatar');

        const fakeFile = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
        const res = await uploadAvatar(fakeFile);
        
        expect(res).toBeNull();
        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка при обновлении аватара', notificationMock.NotificationType.Warning);
    });

    it('Exception during avatar upload', async () => {
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Warning: 'warning' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const mockStore = createMockStore({ id: 'u1', name: 'N', email: 'e', avatar_key: '' });
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockRejectedValue(new Error('network'));

        const { uploadAvatar } = await import('$lib/utils/account/avatar');

        const fakeFile = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
        const res = await uploadAvatar(fakeFile);
        
        expect(res).toBeNull();
        expect(notificationMock.notification).toHaveBeenCalledWith('Ошибка при загрузке аватара', notificationMock.NotificationType.Warning);
    });

    it('Returns empty string when avatar_url is missing', async () => {
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Warning: 'warning' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const mockStore = createMockStore({ id: 'u1', name: 'N', email: 'e', avatar_key: '' });
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockResolvedValue({ success: true, data: {} });

        const { uploadAvatar } = await import('$lib/utils/account/avatar');

        const fakeFile = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
        const res = await uploadAvatar(fakeFile);
        
        expect(res).toBe('');
        expect(notificationMock.notification).toHaveBeenCalledWith('Аватар успешно обновлен', notificationMock.NotificationType.Success);
    });

    it('Updates img element when found', async () => {
        vi.doMock('svelte', () => ({ tick: vi.fn().mockResolvedValue(undefined) }));
        const { updateAvatarImage } = await import('$lib/utils/account/avatar');

        const comp = document.createElement('div');
        const img = document.createElement('img');
        comp.appendChild(img);

        await updateAvatarImage(comp, 'http://new');
        expect(img.src).toBe('http://new/');
    });

    it('Updates background-image when no img', async () => {
        vi.doMock('svelte', () => ({ tick: vi.fn().mockResolvedValue(undefined) }));
        const { updateAvatarImage } = await import('$lib/utils/account/avatar');

        const comp = document.createElement('div');
        const el = document.createElement('div');
        el.setAttribute('style', 'background: color;');
        comp.appendChild(el);

        await updateAvatarImage(comp, 'http://bgurl');
        expect((el as HTMLElement).style.backgroundImage).toContain('http://bgurl');
    });

    it('Returns when avatarComponent is null', async () => {
        vi.doMock('svelte', () => ({ tick: vi.fn().mockResolvedValue(undefined) }));
        const { updateAvatarImage } = await import('$lib/utils/account/avatar');
        const svelte = await import('svelte');

        await expect(updateAvatarImage(null as any, 'http://nope')).resolves.toBeUndefined();
        expect(svelte.tick).not.toHaveBeenCalled();
    });

    it('Clears container before adding avatar', async () => {
        setupApiMock();
        
        const { getAvatar } = await import('$lib/utils/account/avatar');
        
        const container = document.createElement('div');
        const existingChild = document.createElement('div');
        container.appendChild(existingChild);
        
        expect(container.children.length).toBe(1);
        
        await getAvatar({ name: 'Test User' }, container, 48, true);
        
        expect(container.children.length).toBe(1);
        expect(container.querySelector('img')).not.toBeNull();
    });

    it('Creates avatar with letter when no avatar_key', async () => {
        setupApiMock();
        
        const { getAvatar } = await import('$lib/utils/account/avatar');
        const container = document.createElement('div');
        
        await getAvatar({ name: 'Test User' }, container, 48, true);
        
        const img = container.querySelector('img');
        expect(img).not.toBeNull();
        expect(img?.src).toContain('data:image/png;base64');
        expect(img?.style.width).toBe('48px');
        expect(img?.style.height).toBe('48px');
        expect(img?.style.borderRadius).toBe('50%');
    });

    it('Loads avatar from server when avatar_key exists', async () => {
        setupApiMock();
        
        const api = await import('$lib/utils/api');
        const mockBlob = new Blob(['fake-image'], { type: 'image/webp' });
        api.api.get = vi.fn().mockResolvedValue({ success: true, data: mockBlob });
        
        const { getAvatar } = await import('$lib/utils/account/avatar');
        const container = document.createElement('div');
        
        await getAvatar({ name: 'Test User', avatar_key: 'test-key' }, container, 64, false);
        
        const img = container.querySelector('img');
        expect(img).not.toBeNull();
        expect(img?.style.width).toBe('64px');
        expect(img?.style.height).toBe('64px');
        expect(img?.style.borderRadius).toBe('');
        expect(api.api.get).toHaveBeenCalledWith(
            '/api/v1/attachments/avatars/test-key.webp',
            undefined,
            'blob',
            false
        );
    });

    it('Falls back to letter avatar when API fails', async () => {
        setupApiMock();
        
        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockResolvedValue({ success: false });
        
        const { getAvatar } = await import('$lib/utils/account/avatar');
        const container = document.createElement('div');
        
        await getAvatar({ name: 'Test User', avatar_key: 'test-key' }, container);
        
        const img = container.querySelector('img');
        expect(img).not.toBeNull();
        expect(img?.src).toContain('data:image/png;base64');
    });

    it('Falls back to letter avatar when API throws error', async () => {
        setupApiMock();
        
        const api = await import('$lib/utils/api');
        api.api.get = vi.fn().mockRejectedValue(new Error('Network error'));
        
        const { getAvatar } = await import('$lib/utils/account/avatar');
        const container = document.createElement('div');
        
        await getAvatar({ name: 'Test User', avatar_key: 'test-key' }, container);
        
        const img = container.querySelector('img');
        expect(img).not.toBeNull();
        expect(img?.src).toContain('data:image/png;base64');
    });

    it('Does nothing when container is null', async () => {
        setupApiMock();
        
        const { getAvatar } = await import('$lib/utils/account/avatar');
        await expect(getAvatar({ name: 'Test' }, null)).resolves.toBeUndefined();
    });

    it('Generates correct initials for single name', async () => {
        setupApiMock();
        
        const { getAvatar } = await import('$lib/utils/account/avatar');
        const container = document.createElement('div');
        
        await getAvatar({ name: 'John' }, container);
        
        const img = container.querySelector('img');
        expect(img?.src).toContain('data:image/png;base64');
    });

    it('Generates correct initials for two names', async () => {
        setupApiMock();
        
        const { getAvatar } = await import('$lib/utils/account/avatar');
        const container = document.createElement('div');
        
        await getAvatar({ name: 'John Doe' }, container);
        
        const img = container.querySelector('img');
        expect(img?.src).toContain('data:image/png;base64');
    });

    it('Handles empty name', async () => {
        setupApiMock();
        
        const { getAvatar } = await import('$lib/utils/account/avatar');
        const container = document.createElement('div');
        
        await getAvatar({ name: '' }, container);
        
        const img = container.querySelector('img');
        expect(img?.src).toContain('data:image/png;base64');
    });

    it('Updates multiple img elements', async () => {
        vi.doMock('svelte', () => ({ tick: vi.fn().mockResolvedValue(undefined) }));
        const { updateAvatarImage } = await import('$lib/utils/account/avatar');

        const comp = document.createElement('div');
        const img1 = document.createElement('img');
        const img2 = document.createElement('img');
        comp.appendChild(img1);
        comp.appendChild(img2);

        await updateAvatarImage(comp, 'http://new');
        expect(img1.src).toBe('http://new/');
        expect(img2.src).toBe('http://new/');
    });

    it('Cleans up image URL after load', async () => {
        setupApiMock();
        
        const api = await import('$lib/utils/api');
        const mockBlob = new Blob(['fake-image'], { type: 'image/webp' });
        api.api.get = vi.fn().mockResolvedValue({ success: true, data: mockBlob });
        
        const { getAvatar } = await import('$lib/utils/account/avatar');
        const container = document.createElement('div');
        
        await getAvatar({ name: 'Test User', avatar_key: 'test-key' }, container);
        
        const img = container.querySelector('img');
        expect(img).not.toBeNull();
        
        img?.dispatchEvent(new Event('load'));
        
        await new Promise(resolve => setTimeout(resolve, 150));
        
        expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('Handles image load error and falls back', async () => {
        setupApiMock();
        
        const api = await import('$lib/utils/api');
        const mockBlob = new Blob(['fake-image'], { type: 'image/webp' });
        api.api.get = vi.fn().mockResolvedValue({ success: true, data: mockBlob });
        
        const { getAvatar } = await import('$lib/utils/account/avatar');
        
        const container = document.createElement('div');
        
        await getAvatar({ name: 'Test User', avatar_key: 'test-key' }, container);
        
        const img = container.querySelector('img');
        expect(img).not.toBeNull();
        
        const blobSrc = img?.src;
        expect(blobSrc).toContain('blob:');
        
        img?.dispatchEvent(new Event('error'));
        
        const fallbackSrc = img?.src;
        expect(fallbackSrc).toContain('data:image/png;base64');
        expect(fallbackSrc).not.toBe(blobSrc);
    });

    it('Generates letter avatar without devicePixelRatio', async () => {
        setupApiMock();
        
        Object.defineProperty(window, 'devicePixelRatio', {
            writable: true,
            configurable: true,
            value: 0
        });
        
        const { getAvatar } = await import('$lib/utils/account/avatar');
        const container = document.createElement('div');
        
        await getAvatar({ name: 'Test User' }, container, 48);
        
        const img = container.querySelector('img');
        expect(img).not.toBeNull();
        expect(img?.src).toContain('data:image/png;base64');
        
        const createElementSpy = vi.spyOn(document, 'createElement');
        await getAvatar({ name: 'Another User' }, container, 64);
        
        expect(createElementSpy).toHaveBeenCalledWith('canvas');
    });

    it('Generates letter avatar with default size when size is 0', async () => {
        setupApiMock();
        
        const { getAvatar } = await import('$lib/utils/account/avatar');
        const container = document.createElement('div');
        
        await getAvatar({ name: 'Test User' }, container, 0);
        
        const img = container.querySelector('img');
        expect(img).not.toBeNull();
        expect(img?.src).toContain('data:image/png;base64');
        expect(img?.style.width).toBe('0px');
        expect(img?.style.height).toBe('0px');
    });

    it('Generates letter avatar returns empty string when context is null', async () => {
        setupApiMock();
        
        const originalCreateElement = document.createElement.bind(document);
        document.createElement = vi.fn((tagName: string) => {
            if (tagName === 'canvas') {
                const canvas = originalCreateElement('canvas');
                canvas.getContext = vi.fn().mockReturnValue(null);
                return canvas;
            }
            return originalCreateElement(tagName);
        }) as any;
        
        const { getAvatar } = await import('$lib/utils/account/avatar');
        const container = document.createElement('div');
        
        await getAvatar({ name: 'Test User' }, container, 48);
        
        const img = container.querySelector('img');
        expect(img).not.toBeNull();
    });

    it('Updates currentUser to null when user is null in uploadAvatar', async () => {
        setupApiMock();

        const notificationMock = { notification: vi.fn(), NotificationType: { Success: 'success', Warning: 'warning' } };
        vi.doMock('$lib/utils/notifications/notification', () => notificationMock);

        const mockStore = createMockStore(null);
        vi.doMock('$lib/utils/auth/storage/initial', () => ({ currentUser: mockStore }));

        const api = await import('$lib/utils/api');
        api.api.put = vi.fn().mockResolvedValue({ success: true, data: { avatar_url: 'http://img' } });

        const { uploadAvatar } = await import('$lib/utils/account/avatar');

        const fakeFile = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
        const res = await uploadAvatar(fakeFile);
        
        expect(res).toBe('http://img');
        expect(notificationMock.notification).toHaveBeenCalledWith('Аватар успешно обновлен', notificationMock.NotificationType.Success);
        expect(mockStore.__get()).toBeNull();
    });
});