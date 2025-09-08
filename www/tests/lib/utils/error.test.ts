import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { navigateToError } from '$lib/utils/error';

vi.mock('$app/navigation', () => ({
    goto: vi.fn()
}));

const mockBrowser = { value: true };
vi.mock('$app/environment', () => ({
    get browser() {
        return mockBrowser.value;
    }
}));

import { goto } from '$app/navigation';

describe('navigateToError function', () => {
    const originalPushState = window.history.pushState;
    const mockPushState = vi.fn();

    beforeEach(() => {
        window.history.pushState = mockPushState;
        vi.clearAllMocks();
    });

    afterEach(() => {
        window.history.pushState = originalPushState;
    });

    it('Navigate to error page with 403 status', () => {
        navigateToError(403);
        expect(mockPushState).toHaveBeenCalledWith(
            expect.objectContaining({ status: 403 }), 
            '', 
            '/error?status=403'
        )
        expect(goto).toHaveBeenCalledWith('/error?status=403', { replaceState: true });
    });

    it('Navigate to error page with 500 status', () => {
        navigateToError(500);

        expect(mockPushState).toHaveBeenCalledWith(
            expect.objectContaining({ status: 500 }), 
            '', 
            '/error?status=500'
        );      
        expect(goto).toHaveBeenCalledWith('/error?status=500', { replaceState: true });
    });

    it('Do nothing in non-browser environment', () => {
        mockBrowser.value = false;
        
        navigateToError(403);
        
        expect(mockPushState).not.toHaveBeenCalled();
        expect(goto).not.toHaveBeenCalled();
    });
});