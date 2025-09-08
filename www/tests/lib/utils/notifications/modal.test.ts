import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleModalKeydown, showModal } from '$lib/utils/notifications/modal';

describe('Handle keydown in modal', () => {
    let modalElement: HTMLDivElement;

    beforeEach(() => {
        modalElement = document.createElement('div');
        document.body.appendChild(modalElement);

        const button1 = document.createElement('button');
        const input = document.createElement('input');
        const button2 = document.createElement('button');

        modalElement.appendChild(button1);
        modalElement.appendChild(input);
        modalElement.appendChild(button2);
    });

    it('Escape is pressed (false)', () => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        const result = handleModalKeydown(event, modalElement);
        expect(result).toBe(false);
    });

    it('Non-special key is pressed (true)', () => {
        const event = new KeyboardEvent('keydown', { key: 'A' });
        const result = handleModalKeydown(event, modalElement);
        expect(result).toBe(true);
    });

    it('Move focus to first element when Tab is pressed on last element', () => {
        const focusableElements = Array.from(
            modalElement.querySelectorAll('button, input')
        );

        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
        const firstElement = focusableElements[0] as HTMLElement;
        
        lastElement.focus();

        const focusSpy = vi.spyOn(firstElement, 'focus');
        const preventDefaultSpy = vi.fn();
        const event = new KeyboardEvent('keydown', { 
            key: 'Tab',
            shiftKey: false,
            bubbles: true 
        });

        Object.defineProperty(event, 'preventDefault', {
            value: preventDefaultSpy
        });
        Object.defineProperty(document, 'activeElement', {
            value: lastElement,
            writable: true,
            configurable: true
        });

        handleModalKeydown(event, modalElement);

        expect(preventDefaultSpy).toHaveBeenCalled();
        expect(focusSpy).toHaveBeenCalled();
    });

    it('Move focus to last element when Shift+Tab is pressed on first element', () => {
        const focusableElements = Array.from(
            modalElement.querySelectorAll('button, input')
        );

        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
        const firstElement = focusableElements[0] as HTMLElement;

        firstElement.focus();

        const focusSpy = vi.spyOn(lastElement, 'focus');
        const preventDefaultSpy = vi.fn();
        const event = new KeyboardEvent('keydown', { 
            key: 'Tab',
            shiftKey: true,
            bubbles: true 
        });

        Object.defineProperty(event, 'preventDefault', {
            value: preventDefaultSpy
        });
        Object.defineProperty(document, 'activeElement', {
            value: firstElement,
            writable: true,
            configurable: true
        });

        handleModalKeydown(event, modalElement);

        expect(preventDefaultSpy).toHaveBeenCalled();
        expect(focusSpy).toHaveBeenCalled();
    });

    it('Move focus with no elements', () => {
        const emptyModalElement = document.createElement('div');
        
        const preventDefaultSpy = vi.fn();
        const event = new KeyboardEvent('keydown', { 
            key: 'Tab',
            shiftKey: true,
            bubbles: true 
        });

        Object.defineProperty(event, 'preventDefault', {
            value: preventDefaultSpy
        });

        const result = handleModalKeydown(event, emptyModalElement);

        expect(result).toBe(true);
        expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
});

describe('Show modal', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        vi.useFakeTimers();
    });

    it('Display modal', () => {
        const modalElement = document.createElement('div');
        modalElement.className = 'modal';
        document.body.appendChild(modalElement);
        
        showModal(modalElement);
        vi.advanceTimersByTime(150);

        const el = document.querySelector('.modal') as HTMLDivElement;
        expect(el).not.toBeNull();
    });
});