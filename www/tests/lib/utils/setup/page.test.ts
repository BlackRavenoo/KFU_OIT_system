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

beforeEach(() => {
    globalThis.IntersectionObserver = MockIntersectionObserver;
});

afterEach(() => {
    // @ts-ignore
    delete global.IntersectionObserver;
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
});