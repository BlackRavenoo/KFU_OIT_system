import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/utils/api', () => ({ api: { post: vi.fn() } }));
vi.mock('$lib/utils/texteditor/serialize', () => ({ serialize: vi.fn((html: string) => [{ type: 'text', text: html }]) }));

import { savePage, savePageAndGetId } from '$lib/utils/pages/document';
import { api } from '$lib/utils/api';
import { serialize } from '$lib/utils/texteditor/serialize';

describe('Pages API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (serialize as any).mockImplementation((html: string) => [{ type: 'text', text: html }]);
    });

    it('Save page successfully', async () => {
        (serialize as any).mockReturnValue([{ s: 1 }]);
        (api.post as any).mockResolvedValue({ status: 200, data: { id: '123', extra: true } });

        const res = await savePage({
            html: '<p>ok</p>',
            title: 'T',
            tags: [1, 2],
            related: [3],
            is_public: false
        });

        expect(serialize).toHaveBeenCalledWith('<p>ok</p>');
        expect(api.post).toHaveBeenCalledWith('/api/v1/pages/', {
            data: [{ s: 1 }],
            title: 'T',
            tags: [1, 2],
            related: [3],
            is_public: false
        });
        expect(res).toEqual({ id: '123', extra: true });
    });

    it('Save page returns data on 201', async () => {
        (api.post as any).mockResolvedValue({ status: 201, data: { id: '201' } });

        const res = await savePage({
            html: '<p>x</p>',
            title: 'A',
            tags: [],
            related: []
        });

        expect(res).toEqual({ id: '201' });
    });

    it('Save page throws on missing response', async () => {
        (api.post as any).mockResolvedValue(undefined);

        await expect(
            savePage({
                html: '<p>x</p>',
                title: 'A',
                tags: [],
                related: []
            })
        ).rejects.toThrow('Failed to save page');
    });

    it('Save page throws when status is not a number', async () => {
        (api.post as any).mockResolvedValue({ status: 'ok' });

        await expect(
            savePage({
                html: '<p>x</p>',
                title: 'A',
                tags: [],
                related: []
            })
        ).rejects.toThrow('Failed to save page');
    });

    it('Save page throws on non-2xx status', async () => {
        (api.post as any).mockResolvedValue({ status: 500, data: {} });

        await expect(
            savePage({
                html: '<p>x</p>',
                title: 'A',
                tags: [],
                related: []
            })
        ).rejects.toThrow('Failed to save page');
    });

    it('Save page throws on missing id in data', async () => {
        (api.post as any).mockResolvedValue({ status: 200, data: { other: 1 } });

        await expect(
            savePage({
                html: '<p>x</p>',
                title: 'A',
                tags: [],
                related: []
            })
        ).rejects.toThrow('Invalid server response: missing id');
    });

    it('Save page defaults tags, related, is_public', async () => {
        (api.post as any).mockResolvedValue({ status: 200, data: { id: 'abc' } });

        const req = {
            html: '<b>d</b>',
            title: 'Def'
        } as any;

        const res = await savePage(req);

        expect(res).toEqual({ id: 'abc' });
        const call = (api.post as any).mock.calls[0];
        expect(call[0]).toBe('/api/v1/pages/');
        expect(call[1]).toEqual({
            data: [{ type: 'text', text: '<b>d</b>' }],
            title: 'Def',
            tags: [],
            related: [],
            is_public: false
        });
    });

    it('Save page and get ID', async () => {
        (api.post as any).mockResolvedValue({ status: 200, data: { id: 'xyz' } });

        const id = await savePageAndGetId({
            html: '<p>c</p>',
            title: 'C',
            tags: [9],
            related: []
        });

        expect(id).toBe('xyz');
    });
});