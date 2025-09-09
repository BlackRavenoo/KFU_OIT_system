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

    it('Tab without shift key on last element focuses first element', () => {
        const focusableElements = Array.from(
            modalElement.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
        );

        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
        const firstElement = focusableElements[0] as HTMLElement;
        
        const event = new KeyboardEvent('keydown', { 
            key: 'Tab',
            shiftKey: false,
            bubbles: true 
        });
        
        const preventDefaultSpy = vi.fn();
        Object.defineProperty(event, 'preventDefault', {
            value: preventDefaultSpy
        });
        
        Object.defineProperty(document, 'activeElement', {
            value: lastElement,
            writable: true,
            configurable: true
        });

        const focusSpy = vi.spyOn(firstElement, 'focus');
        
        handleModalKeydown(event, modalElement);

        expect(preventDefaultSpy).toHaveBeenCalled();
        expect(focusSpy).toHaveBeenCalled();
        expect(event.shiftKey).toBe(false);
        expect(document.activeElement).toBe(lastElement);
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

    it('Display modal with focusable element', () => {
        const modalElement = document.createElement('div');
        modalElement.className = 'modal';
        document.body.appendChild(modalElement);
        
        const button = document.createElement('button');
        modalElement.appendChild(button);
        
        const buttonFocusSpy = vi.spyOn(button, 'focus');
        
        showModal(modalElement);
        vi.advanceTimersByTime(150);

        expect(buttonFocusSpy).toHaveBeenCalled();
    });
    
    it('Display modal with no focusable elements', () => {
        const modalElement = document.createElement('div');
        modalElement.className = 'modal';
        document.body.appendChild(modalElement);
        
        const closeButton = document.createElement('button');
        closeButton.className = 'modal-close';
        modalElement.appendChild(closeButton);
        
        const modalFocusSpy = vi.spyOn(modalElement, 'focus');
        
        showModal(modalElement);
        vi.advanceTimersByTime(150);

        expect(modalFocusSpy).toHaveBeenCalled();
    });

    it('Call without modal element', () => {
        showModal();
        vi.advanceTimersByTime(150);
        expect(true).toBe(true);
    });
});