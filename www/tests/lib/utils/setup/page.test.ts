import { vi, it, describe, expect, beforeEach, afterEach } from 'vitest';
import { setupIntersectionObserver, loadStyleContent, cleanupStyleElements } from '$lib/utils/setup/page';

class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: ReadonlyArray<number> = [];
    
    constructor(
        private callback: IntersectionObserverCallback,
        private options?: IntersectionObserverInit
    ) {}
    
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn().mockReturnValue([]);
}

let warnSpy: any;

beforeEach(() => {
    globalThis.IntersectionObserver = MockIntersectionObserver;
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    // @ts-ignore
    delete global.IntersectionObserver;
    warnSpy.mockRestore();
});

describe('Setup IntersectionObserver', () => {
    it('Creates IntersectionObserver correctly', () => {
        const el1 = document.createElement('div');
        el1.id = 'el1';
        document.body.appendChild(el1);
        
        const el2 = document.createElement('div');
        el2.id = 'el2';
        document.body.appendChild(el2);

        const visibleElements = {"el1": false, "el2": false};
        
        const observer = setupIntersectionObserver(
            [el1.id, el2.id], 
            visibleElements, 
            { threshold: 0.2, rootMargin: "0px 0px -100px 0px" }
        );

        expect(observer).toBeDefined();
        expect(observer.observe).toHaveBeenCalledTimes(2);
        
        document.body.removeChild(el1);
        document.body.removeChild(el2);
    });
    
    it('Handles intersection correctly', () => {
        let intersectionCallback: IntersectionObserverCallback;
        
        globalThis.IntersectionObserver = class {
            constructor(callback: IntersectionObserverCallback) {
                intersectionCallback = callback;
            }
            observe = vi.fn();
            unobserve = vi.fn();
            disconnect = vi.fn();
            takeRecords = vi.fn().mockReturnValue([]);
            readonly root = null;
            readonly rootMargin = '';
            readonly thresholds = [];
        };
        
        const el1 = document.createElement('div');
        el1.id = 'el1';
        document.body.appendChild(el1);
        
        const visibleElements = {"el1": false};
        
        setupIntersectionObserver([el1.id], visibleElements);
        
        intersectionCallback!([{
            isIntersecting: true,
            target: el1,
            boundingClientRect: {} as DOMRectReadOnly,
            intersectionRatio: 0.5,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            time: 0
        }], {} as IntersectionObserver);
        
        expect(visibleElements.el1).toBe(true);
        
        document.body.removeChild(el1);
    });

    it('Entry is not intersecting', () => {
        const el = { id: 'section1' };
        document.getElementById = vi.fn().mockReturnValue(el);

        (globalThis as any).IntersectionObserver = class {
            cb: any;
            constructor(cb: any) { this.cb = cb; }
            observe(target: any) { this.cb([{ isIntersecting: false, target }]); }
            disconnect() {}
        };

        const visible: Record<string, boolean> = { section1: true };
        setupIntersectionObserver(['section1'], visible);

        expect(visible.section1).toBe(false);
    });

    it('Id not present in visibleElements', () => {
        const el = { id: 'new-section' };
        document.getElementById = vi.fn().mockReturnValue(el);

        (globalThis as any).IntersectionObserver = class {
            cb: any;
            constructor(cb: any) { this.cb = cb; }
            observe(target: any) { this.cb([{ isIntersecting: true, target }]); }
            disconnect() {}
        };

        const visible: Record<string, boolean> = { other: false };
        setupIntersectionObserver(['new-section'], visible);

        expect(visible['new-section']).toBe(false);
    });

    it('Warning when element for id is not found', () => {
        document.getElementById = vi.fn().mockReturnValue(null);

        let observed = false;
        (globalThis as any).IntersectionObserver = class {
            constructor(_cb: any) {}
            observe() { observed = true; }
            disconnect() {}
        };

        const visible: Record<string, boolean> = {};
        setupIntersectionObserver(['missing-id'], visible);

        expect(document.getElementById).toHaveBeenCalledWith('missing-id');
        expect(warnSpy).toHaveBeenCalledWith('Element with id "missing-id" not found for IntersectionObserver.');
        expect(observed).toBe(false);
    });
});

describe('Style element management', () => {
    let styleElements: HTMLElement[] = [];
    
    afterEach(() => {
        cleanupStyleElements(styleElements);
        styleElements = [];
    });
    
    it('Creates style element correctly', () => {
        const cssContent = 'body { color: red; }';
        const style = loadStyleContent(cssContent, styleElements, 'test-style');
        
        expect(style).toBeDefined();
        expect(style.id).toBe('test-style');
        expect(style.textContent).toBe(cssContent);
        expect(document.head.contains(style)).toBe(true);
    });
    
    it('Cleans up style elements', () => {
        const style1 = loadStyleContent('body { color: red; }', styleElements, 'style1');
        const style2 = loadStyleContent('div { color: blue; }', styleElements, 'style2');
        
        expect(document.head.contains(style1)).toBe(true);
        expect(document.head.contains(style2)).toBe(true);
        
        cleanupStyleElements(styleElements);
        
        expect(document.head.contains(style1)).toBe(false);
        expect(document.head.contains(style2)).toBe(false);
    });

    it('Assigns autogenerated id', () => {
        const styleElements: HTMLElement[] = [];
        const css = '.test { color: red }';
        const el = loadStyleContent(css, styleElements);

        expect(el.id).toBe('style-1');
        expect(el.textContent).toBe(css);
        expect(document.head.contains(el)).toBe(true);
        expect(styleElements.length).toBe(1);
        expect(styleElements[0]).toBe(el);

        el.parentNode && el.parentNode.removeChild(el);
        styleElements.length = 0;
    });
});