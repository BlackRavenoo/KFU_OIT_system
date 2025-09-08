import { describe, it, expect, beforeEach, vi } from 'vitest';
import { notification, NotificationType } from '$lib/utils/notifications/notification';

describe('Show notification', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.useFakeTimers();
    });

    it('Display success notification', () => {
        notification('Success message', NotificationType.Success);
        const el = document.querySelector('.notification.success') as HTMLDivElement;
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
        const el = document.querySelector('.notification.error') as HTMLDivElement;
        expect(el).not.toBeNull();
        expect(el.textContent).toBe('Error message');
        expect(el.classList.contains('error')).toBe(true);
    });

    it('Display warning notification', () => {
        notification('Warning message', NotificationType.Warning);
        const el = document.querySelector('.notification.warning') as HTMLDivElement;
        expect(el).not.toBeNull();
        expect(el.textContent).toBe('Warning message');
        expect(el.classList.contains('warning')).toBe(true);
    });

    it('Display info notification', () => {
        notification('Info message', NotificationType.Info);
        const el = document.querySelector('.notification.info') as HTMLDivElement;
        expect(el).not.toBeNull();
        expect(el.textContent).toBe('Info message');
        expect(el.classList.contains('info')).toBe(true);
    });
});