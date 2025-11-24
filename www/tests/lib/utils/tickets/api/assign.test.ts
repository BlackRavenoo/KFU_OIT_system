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

vi.mock('$lib/utils/tickets/api/get', () => {
    return {
        getById: vi.fn()
    };
});
vi.mock('$lib/utils/notifications/notification', () => {
    return {
        notification: vi.fn(),
        NotificationType: { Success: 'success', Error: 'error' }
    };
});

import { it, expect, describe, beforeEach, afterEach } from 'vitest';
import * as assignModule from '$lib/utils/tickets/api/assign';
import { TICKETS_API_ENDPOINTS } from '$lib/utils/tickets/api/endpoints';
import { getById } from '$lib/utils/tickets/api/get';
import { notification } from '$lib/utils/notifications/notification';

describe('Ticket Assignment API', () => {
    const ticketId = 'test-ticket-id';
    const userId = 'user-1';

    beforeEach(() => {
        helpers.resetMocks();
        vi.clearAllMocks();
    });

    afterEach(() => {
        helpers.resetMocks();
    });

    it('Assign should complete successfully', async () => {
        helpers.mockSuccess('patch', { message: 'Ticket assigned successfully' });

        await expect(assignModule.assign(ticketId)).resolves.not.toThrow();

        expect(apiMock.patch).toHaveBeenCalledTimes(1);
        expect(apiMock.patch).toHaveBeenCalledWith(
            `${TICKETS_API_ENDPOINTS.read}${ticketId}/assign`
        );
    });

    it('Unassign should complete successfully', async () => {
        helpers.mockSuccess('patch', { message: 'Ticket unassigned successfully' });

        await expect(assignModule.unassign(ticketId)).resolves.not.toThrow();

        expect(apiMock.patch).toHaveBeenCalledTimes(1);
        expect(apiMock.patch).toHaveBeenCalledWith(
            `${TICKETS_API_ENDPOINTS.read}${ticketId}/unassign`
        );
    });

    it('Assign throw network error', async () => {
        helpers.mockError('patch', 'Ошибка соединения', 0);

        await expect(assignModule.assign(ticketId)).rejects.toThrow('Ошибка соединения');

        expect(apiMock.patch).toHaveBeenCalledTimes(1);
    });

    it('Unassign throw server error', async () => {
        helpers.mockError('patch', 'Internal Server Error', 500);

        await expect(assignModule.unassign(ticketId)).rejects.toThrow('Internal Server Error');

        expect(apiMock.patch).toHaveBeenCalledTimes(1);
    });

    it('Assign throw generic error if API returns success false without message', async () => {
        apiMock.patch.mockResolvedValueOnce({ success: false, status: 400 });

        await expect(assignModule.assign(ticketId)).rejects.toThrow('Ошибка назначения заявки');

        expect(apiMock.patch).toHaveBeenCalledTimes(1);
    });

    it('Unassign throw generic error if API returns success false without message', async () => {
        apiMock.patch.mockResolvedValueOnce({ success: false, status: 400 });

        await expect(assignModule.unassign(ticketId)).rejects.toThrow('Ошибка снятия назначения заявки');

        expect(apiMock.patch).toHaveBeenCalledTimes(1);
    });

    it('Assign user to ticket process successfully', async () => {
        const fakeTicket = { id: ticketId, title: 't' } as any;
        helpers.mockSuccess('post', { message: 'ok' });
        (getById as any).mockResolvedValueOnce(fakeTicket);

        const res = await assignModule.assignUserToTicket(ticketId, userId);

        expect(apiMock.post).toHaveBeenCalledWith(`${TICKETS_API_ENDPOINTS.update}/${ticketId}/assign/${userId}`);
        expect(getById).toHaveBeenCalledWith(ticketId);
        expect(res).toEqual({ success: true, ticket: fakeTicket });
        expect(notification).toHaveBeenCalled();
    });

    it('Assign user to ticket return error and notify on API failure', async () => {
        apiMock.post.mockResolvedValueOnce({ success: false, error: 'User not found' });

        const res = await assignModule.assignUserToTicket(ticketId, userId);

        expect(apiMock.post).toHaveBeenCalledWith(`${TICKETS_API_ENDPOINTS.update}/${ticketId}/assign/${userId}`);
        expect(res).toEqual({ success: false, error: 'User not found' });
        expect(notification).toHaveBeenCalledWith('User not found', 'error');
    });

    it('Assign user to ticket thrown errors', async () => {
        apiMock.post.mockRejectedValueOnce(new Error('network fail'));

        const res = await assignModule.assignUserToTicket(ticketId, userId);

        expect(apiMock.post).toHaveBeenCalledWith(`${TICKETS_API_ENDPOINTS.update}/${ticketId}/assign/${userId}`);
        expect(res.success).toBe(false);
        if ('error' in res) {
            expect(typeof res.error).toBe('string');
            expect(res.error).toContain('network fail');
        }
        expect(notification).toHaveBeenCalled();
    });

    it('Unassign user from ticket process successfully', async () => {
        const fakeTicket = { id: ticketId, title: 't2' } as any;
        helpers.mockSuccess('post', { message: 'ok' });
        (getById as any).mockResolvedValueOnce(fakeTicket);

        const res = await assignModule.unassignUserFromTicket(ticketId, userId);

        expect(apiMock.post).toHaveBeenCalledWith(`${TICKETS_API_ENDPOINTS.update}/${ticketId}/unassign/${userId}`);
        expect(getById).toHaveBeenCalledWith(ticketId);
        expect(res).toEqual({ success: true, ticket: fakeTicket });
        expect(notification).toHaveBeenCalled();
    });

    it('Unassign user from ticket return error and notify on API failure', async () => {
        apiMock.post.mockResolvedValueOnce({ success: false, error: 'Executor not found' });

        const res = await assignModule.unassignUserFromTicket(ticketId, userId);

        expect(apiMock.post).toHaveBeenCalledWith(`${TICKETS_API_ENDPOINTS.update}/${ticketId}/unassign/${userId}`);
        expect(res).toEqual({ success: false, error: 'Executor not found' });
        expect(notification).toHaveBeenCalledWith('Executor not found', 'error');
    });

    it('Unassign user from ticket thrown errors', async () => {
        apiMock.post.mockRejectedValueOnce(new Error('unassign fail'));

        const res = await assignModule.unassignUserFromTicket(ticketId, userId);

        expect(apiMock.post).toHaveBeenCalledWith(`${TICKETS_API_ENDPOINTS.update}/${ticketId}/unassign/${userId}`);
        expect(res.success).toBe(false);
        if ('error' in res) {
            expect(typeof res.error).toBe('string');
            expect(res.error).toContain('unassign fail');
        }
        expect(notification).toHaveBeenCalled();
    });

    it('Assign user to ticket returns fallback error when API replies without error text', async () => {
        (apiMock.post).mockResolvedValueOnce({ success: false });

        const res = await assignModule.assignUserToTicket(ticketId, userId);

        expect(res).toEqual({ success: false, error: 'Ошибка при назначении сотрудника' });
        expect(notification).toHaveBeenCalledWith('Ошибка при назначении сотрудника', 'error');
    });

    it('Assign user to ticket returns fallback error from catch when rejection is non-Error', async () => {
        apiMock.post.mockRejectedValueOnce(null);

        const res = await assignModule.assignUserToTicket(ticketId, userId);

        expect(apiMock.post).toHaveBeenCalledWith(`${TICKETS_API_ENDPOINTS.update}/${ticketId}/assign/${userId}`);
        expect(res).toEqual({ success: false, error: 'Ошибка при назначении сотрудника' });
        expect(notification).toHaveBeenCalledWith('Ошибка при назначении сотрудника', 'error');
    });

    it('Unassign user from ticket returns fallback error when API replies without error text', async () => {
        (apiMock.post).mockResolvedValueOnce({ success: false });

        const res = await assignModule.unassignUserFromTicket(ticketId, userId);

        expect(res).toEqual({ success: false, error: 'Ошибка при снятии исполнителя' });
        expect(notification).toHaveBeenCalledWith('Ошибка при снятии исполнителя', 'error');
    });

    it('Unassign user from ticket returns fallback error from catch when rejection is non-Error', async () => {
        apiMock.post.mockRejectedValueOnce(null);

        const res = await assignModule.unassignUserFromTicket(ticketId, userId);

        expect(apiMock.post).toHaveBeenCalledWith(`${TICKETS_API_ENDPOINTS.update}/${ticketId}/unassign/${userId}`);
        expect(res).toEqual({ success: false, error: 'Ошибка при снятии исполнителя' });
        expect(notification).toHaveBeenCalledWith('Ошибка при снятии исполнителя', 'error');
    });
});