import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { notification } from '$lib/utils/notifications/notification';
import { NotificationType } from '$lib/utils/notifications/types';

describe('Show notification', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="notificationContainer"></div>';
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('Display success notification', () => {
        notification('Success message', NotificationType.Success);
        const container = document.getElementById('notificationContainer');
        const el = container?.querySelector('.notification.success') as HTMLDivElement;
        expect(el).not.toBeNull();
        expect(el.textContent).toBe('Success message');
        expect(el.classList.contains('success')).toBe(true);
        expect(el.style.opacity).toBe('0');
        expect(el.style.transform).toBe('translateY(-20px)');
        vi.advanceTimersByTime(10);
        expect(el.style.opacity).toBe('1');
        expect(el.style.transform).toBe('translateY(0)');
        vi.advanceTimersByTime(3000);
        expect(el.style.opacity).toBe('0');
        expect(el.style.transform).toBe('translateY(-20px)');
        vi.advanceTimersByTime(400);
        expect(document.body.contains(el)).toBe(false);
    });

    it('Display error notification', () => {
        notification('Error message', NotificationType.Error);
        const container = document.getElementById('notificationContainer');
        const el = container?.querySelector('.notification.error') as HTMLDivElement;
        expect(el).not.toBeNull();
        expect(el.textContent).toBe('Error message');
        expect(el.classList.contains('error')).toBe(true);
    });

    it('Display warning notification', () => {
        notification('Warning message', NotificationType.Warning);
        const container = document.getElementById('notificationContainer');
        const el = container?.querySelector('.notification.warning') as HTMLDivElement;
        expect(el).not.toBeNull();
        expect(el.textContent).toBe('Warning message');
        expect(el.classList.contains('warning')).toBe(true);
    });

    it('Display info notification', () => {
        notification('Info message', NotificationType.Info);
        const container = document.getElementById('notificationContainer');
        const el = container?.querySelector('.notification.info') as HTMLDivElement;
        expect(el).not.toBeNull();
        expect(el.textContent).toBe('Info message');
        expect(el.classList.contains('info')).toBe(true);
    });

    it('Display notification without class', () => {
        notification('Info message', 'TEST' as NotificationType);
        const container = document.getElementById('notificationContainer');
        const el = container?.querySelector('.notification') as HTMLDivElement;
        expect(el).not.toBeNull();
        expect(el.textContent).toBe('Info message');
        expect(el.style.backgroundColor).toBe('rgba(60, 60, 60, 0.92)');
        expect(el.style.color).toBe('rgb(240, 240, 240)');
        expect(el.classList.contains('info')).toBe(false);
        expect(el.classList.contains('success')).toBe(false);
        expect(el.classList.contains('warning')).toBe(false);
        expect(el.classList.contains('error')).toBe(false);
    });

    it('Notification element closes on left click (pointerdown)', () => {
        notification('Click close', NotificationType.Info);
        const container = document.getElementById('notificationContainer')!;
        const el = container.querySelector('.notification') as HTMLDivElement;
        expect(el).not.toBeNull();
        expect(el.style.pointerEvents).toBe('auto');
        const ev = new MouseEvent('pointerdown', { bubbles: true, button: 0 });
        el.dispatchEvent(ev);
        expect(document.body.contains(el)).toBe(false);
    });

    it('Notification closes on right click', () => {
        notification('Right click close', NotificationType.Info);
    
        const container = document.getElementById('notificationContainer')!;
        const el = container.querySelector('.notification') as HTMLDivElement;
        expect(el).not.toBeNull();
    
        let prevented = false;
        const spy = (e: Event) => {
            if (e.defaultPrevented) prevented = true;
        };
    
        document.addEventListener('contextmenu', spy);
        const ev = new MouseEvent('pointerdown', { bubbles: true, button: 2 });
    
        el.dispatchEvent(ev);
        expect(document.body.contains(el)).toBe(false);
    
        const cmEv = new Event('contextmenu', { bubbles: true, cancelable: true });
        const canceled = !document.dispatchEvent(cmEv);
    
        document.removeEventListener('contextmenu', spy);
        expect(document.body.contains(el)).toBe(false);
    });

    it('Notification closes on middle click', () => {
        notification('Middle close', NotificationType.Info);
        const container = document.getElementById('notificationContainer')!;
        const el = container.querySelector('.notification') as HTMLDivElement;
        expect(el).not.toBeNull();
        const aux = new MouseEvent('auxclick', { bubbles: true, button: 1 });
        el.dispatchEvent(aux);
        expect(document.body.contains(el)).toBe(false);
    });

    it('Moves container and enables container pointer-events', () => {
        document.body.innerHTML = '<button id="wrapper" style="pointer-events:none"><div id="notificationContainer"></div></button>';
        vi.useFakeTimers();
        notification('Move test', NotificationType.Success);
        const container = document.getElementById('notificationContainer')!;
        expect(container).not.toBeNull();
        expect(container.parentElement).toBe(document.body);
        expect(container.style.pointerEvents).toBe('auto');
        const el = container.querySelector('.notification') as HTMLDivElement;
        expect(el).not.toBeNull();
        expect(el.style.pointerEvents).toBe('auto');
        vi.advanceTimersByTime(4000);
    });

    it('Close clears removeTimer when removeTimer has been scheduled', () => {
        vi.useFakeTimers();
        const origSet = global.setTimeout;
        const origClear = global.clearTimeout;
        const wrappers: any[] = [];
        const cleared: any[] = [];
        global.setTimeout = ((fn: TimerHandler, ms?: number | undefined, ...args: any[]) => {
            const realId = (origSet as any)(fn, ms, ...args);
            const wrapper = { __real: realId };
            wrappers.push(wrapper);
            return wrapper;
        }) as unknown as typeof setTimeout;
        global.clearTimeout = ((id?: any) => {
            cleared.push(id);
            id && id.__real !== undefined ?
            (origClear as any)(id.__real) :
            (origClear as any)(id);
        }) as unknown as typeof clearTimeout;
        try {
            notification('RemoveTimer test', NotificationType.Info);
            const container = document.getElementById('notificationContainer')!;
            const el = container.querySelector('.notification') as HTMLDivElement;
            expect(el).not.toBeNull();
            vi.advanceTimersByTime(3000);
            expect(wrappers.length).toBeGreaterThanOrEqual(2);
            const maybeRemoveWrapperBefore = wrappers[wrappers.length - 1];
            expect(maybeRemoveWrapperBefore).not.toBeUndefined();
            const ev = new MouseEvent('pointerdown', { bubbles: true, button: 0 });
            el.dispatchEvent(ev);
            const found = cleared.find(x => x === maybeRemoveWrapperBefore);
            expect(found).toBeDefined();
        } finally {
            global.setTimeout = origSet;
            global.clearTimeout = origClear;
            vi.useRealTimers();
            document.body.innerHTML = '';
        }
    });

    it('Handler is invoked on click and clears scheduled removeTimer', () => {
        vi.useFakeTimers();
        const origClear = global.clearTimeout;
        const cleared: any[] = [];
        global.clearTimeout = ((id?: any) => {
            cleared.push(id);
            (origClear as any)(id);
        }) as typeof clearTimeout;      
        try {
            notification('Click handler test', NotificationType.Info);
            const container = document.getElementById('notificationContainer')!;
            const el = container.querySelector('.notification') as HTMLDivElement;
            expect(el).not.toBeNull();      
            vi.advanceTimersByTime(3010);
            expect(el.parentElement).not.toBeNull();        
            const ev = new MouseEvent('click', { bubbles: true, button: 0 });
            el.dispatchEvent(ev);       
            expect(document.body.contains(el)).toBe(false);
            expect(cleared.length).toBeGreaterThan(0);
        } finally {
            global.clearTimeout = origClear;
            vi.useRealTimers();
            document.body.innerHTML = '';
        }
    });

    it('Auxclick with button 3 closes the notification', () => {
        notification('Aux button 3', NotificationType.Info);
        const container = document.getElementById('notificationContainer')!;
        const el = container.querySelector('.notification') as HTMLDivElement;
        expect(el).not.toBeNull();

        const ev = new MouseEvent('auxclick', { bubbles: true, button: 3, cancelable: true });
        el.dispatchEvent(ev);

        expect(ev.defaultPrevented).toBe(true);
        expect(document.body.contains(el)).toBe(false);
    });

    it('Prevents default on pointerdown/click/auxclick/contextmenu handlers', () => {
        notification('pd-2', NotificationType.Info);
        let container = document.getElementById('notificationContainer')!;
        let el = container.querySelector('.notification') as HTMLDivElement;
        expect(el).not.toBeNull();
        let ev = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 2 });
        let r = el.dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(true);
        expect(r).toBe(false);

        notification('pd-3', NotificationType.Info);
        container = document.getElementById('notificationContainer')!;
        el = container.querySelectorAll('.notification')[0] as HTMLDivElement;
        expect(el).not.toBeNull();
        ev = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 3 });
        r = el.dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(true);
        expect(r).toBe(false);

        notification('click-2', NotificationType.Info);
        container = document.getElementById('notificationContainer')!;
        el = container.querySelectorAll('.notification')[0] as HTMLDivElement;
        expect(el).not.toBeNull();
        ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 2 });
        r = el.dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(true);
        expect(r).toBe(false);

        notification('aux-1', NotificationType.Info);
        container = document.getElementById('notificationContainer')!;
        el = container.querySelectorAll('.notification')[0] as HTMLDivElement;
        expect(el).not.toBeNull();
        ev = new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 });
        r = el.dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(true);
        expect(r).toBe(false);

        notification('aux-3', NotificationType.Info);
        container = document.getElementById('notificationContainer')!;
        el = container.querySelectorAll('.notification')[0] as HTMLDivElement;
        expect(el).not.toBeNull();
        ev = new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 3 });
        r = el.dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(true);
        expect(r).toBe(false);

        notification('aux-0', NotificationType.Info);
        container = document.getElementById('notificationContainer')!;
        el = container.querySelectorAll('.notification')[0] as HTMLDivElement;
        expect(el).not.toBeNull();
        ev = new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 0 });
        r = el.dispatchEvent(ev);
        expect(ev.defaultPrevented).toBe(true);
        expect(r).toBe(false);

        notification('ctx', NotificationType.Info);
        container = document.getElementById('notificationContainer')!;
        el = container.querySelectorAll('.notification')[0] as HTMLDivElement;
        expect(el).not.toBeNull();
        const cev = new Event('contextmenu', { bubbles: true, cancelable: true });
        const cr = el.dispatchEvent(cev);
        expect(cev.defaultPrevented).toBe(true);
        expect(cr).toBe(false);
    });
});