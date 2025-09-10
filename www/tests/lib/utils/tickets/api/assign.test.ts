import { vi } from 'vitest';

globalThis.document = globalThis.document || {
    cookie: '',
    querySelector: vi.fn().mockReturnValue({ scrollIntoView: vi.fn() }),
    querySelectorAll: vi.fn().mockReturnValue([]),
    getElementById: vi.fn(),
    createElement: vi.fn().mockReturnValue({ 
        setAttribute: vi.fn(),
        appendChild: vi.fn()
    }),
    body: { appendChild: vi.fn() },
    location: { href: 'http://localhost:3000/' }
} as any;

globalThis.window = globalThis.window || {
    document: globalThis.document,
    location: { href: 'http://localhost:3000/' },
    scrollTo: vi.fn(),
    localStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn()
    },
    sessionStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn()
    }
} as any;

import setupApiMock from '../../../../apiClientMock';

const { apiMock, helpers } = setupApiMock();

import { it, expect, describe, beforeEach } from 'vitest';
import { assign, unassign } from '$lib/utils/tickets/api/assign';
import { TICKETS_API_ENDPOINTS } from '$lib/utils/tickets/api/endpoints';

describe('Ticket Assignment API', () => {
    const ticketId = 'test-ticket-id';
    
    beforeEach(() => {
        helpers.resetMocks();
    });

    it('Assign should complete successfully', async () => {
        helpers.mockSuccess('patch', { message: 'Ticket assigned successfully' });
        
        await expect(assign(ticketId)).resolves.not.toThrow();
        
        expect(apiMock.patch).toHaveBeenCalledTimes(1);
        expect(apiMock.patch).toHaveBeenCalledWith(
            `${TICKETS_API_ENDPOINTS.read}${ticketId}/assign`
        );
    });

    it('Unassign should complete successfully', async () => {
        helpers.mockSuccess('patch', { message: 'Ticket unassigned successfully' });
        
        await expect(unassign(ticketId)).resolves.not.toThrow();
        
        expect(apiMock.patch).toHaveBeenCalledTimes(1);
        expect(apiMock.patch).toHaveBeenCalledWith(
            `${TICKETS_API_ENDPOINTS.read}${ticketId}/unassign`
        );
    });

    it('Assign should throw error on network error', async () => {
        helpers.mockError('patch', 'Ошибка соединения', 0);
        
        await expect(assign(ticketId)).rejects.toThrow('Ошибка соединения');
        
        expect(apiMock.patch).toHaveBeenCalledTimes(1);
    });

    it('Unassign should throw error on server error', async () => {
        helpers.mockError('patch', 'Internal Server Error', 500);
        
        await expect(unassign(ticketId)).rejects.toThrow('Internal Server Error');
        
        expect(apiMock.patch).toHaveBeenCalledTimes(1);
    });

    it('Assign should throw generic error if no error message', async () => {
        apiMock.patch.mockResolvedValueOnce({ success: false, status: 400 });
        
        await expect(assign(ticketId)).rejects.toThrow('Ошибка назначения заявки');
        
        expect(apiMock.patch).toHaveBeenCalledTimes(1);
    });

    it('Unassign should throw generic error if no error message', async () => {
        apiMock.patch.mockResolvedValueOnce({ success: false, status: 400 });
        
        await expect(unassign(ticketId)).rejects.toThrow('Ошибка снятия назначения заявки');
        
        expect(apiMock.patch).toHaveBeenCalledTimes(1);
    });
});