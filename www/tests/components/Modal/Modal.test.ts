import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { showModalWithFocus, handleModalKeydown, handleConfirmationKeydown, setupKeydownListener, removeKeydownListener, } from "$lib/components/Modal/Modal";

describe("Modal component utilities", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("Show modal and focuses first focusable element", () => {
        const setShow = vi.fn();
        const focusSpy = vi.fn();
        const firstElem = { focus: focusSpy } as unknown as HTMLElement;
        const nodeList = [firstElem] as unknown as NodeListOf<HTMLElement>;
        const modalFake = { querySelectorAll: vi.fn(() => nodeList) } as unknown as HTMLElement;

        showModalWithFocus(setShow, modalFake as unknown as any);
        expect(setShow).toHaveBeenCalledWith(true);

        vi.advanceTimersByTime(100);
        expect(modalFake.querySelectorAll).toHaveBeenCalled();
        expect(focusSpy).toHaveBeenCalled();
    });

    it("Show modal when no focusable elements", () => {
        const setShow = vi.fn();
        const emptyNodeList = [] as unknown as NodeListOf<HTMLElement>;
        const modalFake = { querySelectorAll: vi.fn(() => emptyNodeList) } as unknown as HTMLElement;

        showModalWithFocus(setShow, modalFake as unknown as any);
        vi.advanceTimersByTime(100);
        expect(setShow).toHaveBeenCalledWith(true);
        expect(modalFake.querySelectorAll).toHaveBeenCalled();
    });

    it("Close modal on Escape and Enter", () => {
        const close = vi.fn();

        const escapeEvent = new KeyboardEvent("keydown", { key: "Escape" });
        expect(handleModalKeydown(escapeEvent, close)).toBe(true);
        expect(close).toHaveBeenCalledTimes(1);

        const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
        expect(handleModalKeydown(enterEvent, close)).toBe(true);
        expect(close).toHaveBeenCalledTimes(2);
    });

    it("Handle other keys", () => {
        const close = vi.fn();
        const other = new KeyboardEvent("keydown", { key: "a" });
        expect(handleModalKeydown(other, close)).toBe(false);
        expect(close).not.toHaveBeenCalled();
    });

    it("Call cancel on Escape and confirm on Enter", () => {
        const confirm = vi.fn();
        const cancel = vi.fn();

        const escapeEvent = new KeyboardEvent("keydown", { key: "Escape" });
        expect(handleConfirmationKeydown(escapeEvent, confirm, cancel)).toBe(true);
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(confirm).not.toHaveBeenCalled();

        const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
        expect(handleConfirmationKeydown(enterEvent, confirm, cancel)).toBe(true);
        expect(confirm).toHaveBeenCalledTimes(1);
    });

    it("Handle other keys in confirmation", () => {
        const confirm = vi.fn();
        const cancel = vi.fn();
        const other = new KeyboardEvent("keydown", { key: " " });
        
        expect(handleConfirmationKeydown(other, confirm, cancel)).toBe(false);
        expect(confirm).not.toHaveBeenCalled();
        expect(cancel).not.toHaveBeenCalled();
    });

    it("Add/remove window keydown listener", () => {
        const addSpy = vi.spyOn(window, "addEventListener");
        const removeSpy = vi.spyOn(window, "removeEventListener");
        const handler = vi.fn();

        setupKeydownListener(handler);
        expect(addSpy).toHaveBeenCalledWith("keydown", handler);

        removeKeydownListener(handler);
        expect(removeSpy).toHaveBeenCalledWith("keydown", handler);
    });
});