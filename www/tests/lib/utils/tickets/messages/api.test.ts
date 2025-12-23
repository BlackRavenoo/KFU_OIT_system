import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as apiModule from '$lib/utils/api';
import * as messagesApi from '$lib/utils/tickets/messages/api';

vi.mock('$lib/utils/api', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
    }
}));

const ticketId = 123;
const messageId = 456;
const BASE = '/api/v1/tickets';

describe('Ticket chat', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('Get messages with correct params', async () => {
        const params = { before: 10 };
        (apiModule.api.get as any).mockResolvedValue({ success: true, data: [] });
        const res = await messagesApi.getMessages(ticketId, params);
        expect(apiModule.api.get).toHaveBeenCalledWith(`${BASE}/${ticketId}/messages`, params);
        expect(res).toEqual({ success: true, data: [] });
    });

    it('Get messages with empty params if not provided', async () => {
        (apiModule.api.get as any).mockResolvedValue({ success: true, data: [] });
        await messagesApi.getMessages(ticketId);
        expect(apiModule.api.get).toHaveBeenCalledWith(`${BASE}/${ticketId}/messages`, {});
    });

    it('Create message with correct params', async () => {
        const data = { message: 'hi', is_internal: false };
        (apiModule.api.post as any).mockResolvedValue({ success: true });
        const res = await messagesApi.createMessage(ticketId, data);
        expect(apiModule.api.post).toHaveBeenCalledWith(`${BASE}/${ticketId}/messages`, data);
        expect(res).toEqual({ success: true });
    });

    it('Delete message with correct params', async () => {
        (apiModule.api.delete as any).mockResolvedValue({ success: true });
        const res = await messagesApi.deleteMessage(ticketId, messageId);
        expect(apiModule.api.delete).toHaveBeenCalledWith(`${BASE}/${ticketId}/messages/${messageId}`);
        expect(res).toEqual({ success: true });
    });

    describe('Subscribe messages', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('Calls onUpdate with messages and polls again', async () => {
            const params = { before: 10 };
            const messages = [{ id: 1, text: 'a' }];
            (apiModule.api.get as any).mockResolvedValue({ success: true, data: messages });

            const onUpdate = vi.fn();

            const unsub = messagesApi.subscribeMessages(ticketId, params, onUpdate);

            await Promise.resolve();
            await vi.runAllTicks();
            await Promise.resolve();
            await vi.runAllTicks();

            expect(apiModule.api.get).toHaveBeenCalledWith(`${BASE}/${ticketId}/messages`, params);
            expect(onUpdate).toHaveBeenCalledWith(messages);

            vi.runOnlyPendingTimers();
            await Promise.resolve();
            await vi.runAllTicks();
            await Promise.resolve();
            await vi.runAllTicks();

            expect(apiModule.api.get).toHaveBeenCalledTimes(2);

            unsub();
            vi.runOnlyPendingTimers();
            await Promise.resolve();
            await vi.runAllTicks();
            expect(apiModule.api.get).toHaveBeenCalledTimes(2);
        });

        it('Doesnt call onUpdate if isnt success', async () => {
            (apiModule.api.get as any).mockResolvedValue({ success: false });
            const onUpdate = vi.fn();
            messagesApi.subscribeMessages(ticketId, undefined, onUpdate);
            await Promise.resolve();
            await vi.runAllTicks();
            await Promise.resolve();
            await vi.runAllTicks();
            expect(onUpdate).not.toHaveBeenCalled();
        });

        it('Doesnt call onUpdate if data is not array', async () => {
            (apiModule.api.get as any).mockResolvedValue({ success: true, data: null });
            const onUpdate = vi.fn();
            messagesApi.subscribeMessages(ticketId, undefined, onUpdate);
            await Promise.resolve();
            await vi.runAllTicks();
            await Promise.resolve();
            await vi.runAllTicks();
            expect(onUpdate).not.toHaveBeenCalled();
        });

        it('Clears timer on unsubscribe', async () => {
            (apiModule.api.get as any).mockResolvedValue({ success: true, data: [] });
            const clear = vi.spyOn(global, 'clearTimeout');
            const unsub = messagesApi.subscribeMessages(ticketId, undefined, () => {});
            await Promise.resolve();
            await vi.runAllTicks();
            await Promise.resolve();
            await vi.runAllTicks();
            unsub();
            expect(clear).toHaveBeenCalled();
        });

        it('Calls console.warn if unsubscribe called before timer is set', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            (apiModule.api.get as any).mockImplementation(() => new Promise(() => {}));
            const onUpdate = vi.fn();

            const unsub = messagesApi.subscribeMessages(ticketId, undefined, onUpdate);
            unsub();

            expect(warn).toHaveBeenCalledWith('No timer to clear in subscribeMessages');
            warn.mockRestore();
        });
    });
});