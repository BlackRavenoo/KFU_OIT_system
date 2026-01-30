import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/utils/api', () => ({ api: { post: vi.fn(), get: vi.fn(), put: vi.fn() } }));
vi.mock('$lib/utils/texteditor/serialize', () => ({
    serialize: vi.fn((html: string) => [{ type: 'text', text: html }]),
    deserialize: vi.fn(() => '<p>DESERIALIZED</p>')
}));

import { savePage, savePageAndGetId, fetchPageContentByKey, updatePage, computeDiff } from '$lib/utils/pages/document';
import { api } from '$lib/utils/api';
import { serialize, deserialize } from '$lib/utils/texteditor/serialize';

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

describe('fetchPageContentByKey', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (deserialize as any).mockImplementation(() => '<p>DESERIALIZED</p>');
    });

    it('Returns deserialized HTML for array data', async () => {
        const data = { text: [{ type: 'text', text: 'Hi' }] };
        const html = await fetchPageContentByKey(data as any);
        expect(deserialize).toHaveBeenCalledWith([{ type: 'text', text: 'Hi' }]);
        expect(html).toBe('<p>DESERIALIZED</p>');
    });

    it('Parses JSON string payload', async () => {
        const payload = JSON.stringify([{ type: 'text', text: 'X' }]);
        const data = { text: payload };
        const html = await fetchPageContentByKey(data as any);
        expect(deserialize).toHaveBeenCalledWith([{ type: 'text', text: 'X' }]);
        expect(html).toBe('<p>DESERIALIZED</p>');
    });

    it('Returns raw string when server returns non-JSON string', async () => {
        const data = { text: '<p>RAW</p>' };
        const html = await fetchPageContentByKey(data as any);
        expect(deserialize).not.toHaveBeenCalled();
        expect(html).toBe('<p>RAW</p>');
    });

    it('Throws on non-array and non-string data', async () => {
        const data = { text: { a: 1 } };
        await expect(fetchPageContentByKey(data as any)).rejects.toThrow('Некорректный формат контента');
    });

    it('Throws on undefined data', async () => {
        const data = { text: undefined };
        await expect(fetchPageContentByKey(data as any)).rejects.toThrow('Некорректный формат контента');
    });

    it('Returns string as-is when text is a valid JSON, but not an array', async () => {
        const data = { text: '{"foo":"bar"}' };
        const html = await fetchPageContentByKey(data as any);
        expect(html).toBe('{"foo":"bar"}');
    });
});

describe('updatePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (serialize as any).mockImplementation((html: string) => [{ type: 'text', text: html }]);
    });

    it('Succeeds on 200 status and sends correct payload', async () => {
        (api.get as any).mockResolvedValue({ status: 200, data: { tags: [], related: [] } });
        (api.put as any).mockResolvedValue({ status: 200 });

        const req = {
            html: '<p>content</p>',
            title: 'Title',
            tags: [ '1', 2, '2', '3.5', -1 ],
            related: [ '5', 5, 'x', 6.0 ],
            is_public: true
        } as any;

        await expect(updatePage('123', req)).resolves.toBeUndefined();

        expect(serialize).toHaveBeenCalledWith('<p>content</p>');
        const call = (api.put as any).mock.calls[0];
        expect(call[0]).toBe('/api/v1/pages/123');
        expect(call[1]).toEqual({
            data: [{ type: 'text', text: '<p>content</p>' }],
            title: 'Title',
            tags_to_add: [1, 2],
            tags_to_delete: [],
            related_to_add: [5, 6],
            related_to_delete: [],
            is_public: true
        });
    });

    it.each([200, 201, 204])('Accepts status %i as success', async (status) => {
        (api.get as any).mockResolvedValue({ status: 200, data: { tags: [], related: [] } });
        (api.put as any).mockResolvedValue({ status });
        await expect(updatePage('9', { html: '<p>x</p>', title: 'T', tags: [], related: [] })).resolves.toBeUndefined();
    });

    it('Encodes id in URL', async () => {
        (api.get as any).mockResolvedValue({ status: 200, data: { tags: [], related: [] } });
        (api.put as any).mockResolvedValue({ status: 200 });
        await updatePage('a b/§', { html: '', title: '', tags: [], related: [] });
        expect((api.put as any).mock.calls[0][0]).toBe('/api/v1/pages/' + encodeURIComponent('a b/§'));
    });

    it('Throws when response is undefined', async () => {
        (api.get as any).mockResolvedValue({ status: 200, data: { tags: [], related: [] } });
        (api.put as any).mockResolvedValue(undefined);
        await expect(updatePage('1', { html: '', title: '', tags: [], related: [] })).rejects.toThrow('Failed to update page');
    });

    it('Throws when status is not a number', async () => {
        (api.get as any).mockResolvedValue({ status: 200, data: { tags: [], related: [] } });
        (api.put as any).mockResolvedValue({ status: 'ok' });
        await expect(updatePage('1', { html: '', title: '', tags: [], related: [] })).rejects.toThrow('Failed to update page');
    });

    it('Throws on non-2xx/204 status', async () => {
        (api.get as any).mockResolvedValue({ status: 200, data: { tags: [], related: [] } });
        (api.put as any).mockResolvedValue({ status: 500, error: 'server' });
        await expect(updatePage('1', { html: '', title: '', tags: [], related: [] })).rejects.toThrow('Failed to update page');
    });

    it('Uses [] when req.tags is undefined (triggers ?? [])', async () => {
        (api.get as any).mockResolvedValue({ status: 200, data: { tags: [], related: [] } });
        (api.put as any).mockResolvedValue({ status: 200 });

        const req: any = {
            html: '<p>test</p>',
            title: 'T',
            related: [1, 2],
            is_public: true
        };

        await expect(updatePage('42', req)).resolves.toBeUndefined();

        expect(serialize).toHaveBeenCalledWith('<p>test</p>');
        const call = (api.put as any).mock.calls[0];
        expect(call).toBeDefined();
        const payload = call[1];
        expect(payload).toBeDefined();
    });

    it('Uses [] when req.related is undefined (triggers ?? [])', async () => {
        (api.get as any).mockResolvedValue({ status: 200, data: { tags: [], related: [] } });
        (api.put as any).mockResolvedValue({ status: 200 });

        const req: any = {
            html: '<p>test</p>',
            title: 'T',
            tags: [1, 2],
            is_public: true
        };

        await expect(updatePage('42', req)).resolves.toBeUndefined();

        expect(serialize).toHaveBeenCalledWith('<p>test</p>');
        const call = (api.put as any).mock.calls[0];
        expect(call).toBeDefined();
        const payload = call[1];
        expect(payload).toBeDefined();
    });

    it('Returns toDelete with ids not in desired', () => {
        const current = [1, 2, 3, 4];
        const desired = [2, 4, 5];
        const result = computeDiff(current, desired);

        expect(result.toDelete).toEqual([1, 3]);
        expect(result.toAdd).toEqual([5]);
    });

    it.each([201, 304])('Succeed with status %i', async (status) => {
        (api.get as any).mockResolvedValue({
            status,
            data: { tags: [{ id: 1 }], related: [{ id: 2 }] }
        });
        (api.put as any).mockResolvedValue({ status: 200 });

        const req = {
            html: '<p>test</p>',
            title: 'Test',
            tags: [1],
            related: [2],
            is_public: true
        };

        await expect(updatePage('123', req)).resolves.toBeUndefined();

        expect(api.get).toHaveBeenCalledWith('/api/v1/pages/123');
        expect(api.put).toHaveBeenCalledWith(
            '/api/v1/pages/123',
            expect.objectContaining({
                tags_to_add: [],
                tags_to_delete: [],
                related_to_add: [],
                related_to_delete: [],
                is_public: true
            })
        );
    });

    it('Calls console.warn when fetching current page data fails', async () => {
        (api.get as any).mockResolvedValue({ status: 404, data: null });
        (api.put as any).mockResolvedValue({ status: 200 });

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(updatePage('notfound', {
            html: '<p>fail</p>',
            title: 'Fail',
            tags: [],
            related: [],
            is_public: false
        })).resolves.toBeUndefined();

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('Failed to fetch current page data for ID notfound')
        );

        warnSpy.mockRestore();
    });

    it('Assigns empty arrays when tags and related are undefined', async () => {
        (api.get as any).mockResolvedValue({
            status: 200,
            data: { tags: undefined, related: undefined }
        });
        (api.put as any).mockResolvedValue({ status: 200 });

        const req = {
            html: '<p>test</p>',
            title: 'Test',
            tags: [],
            related: [],
            is_public: false
        };

        await updatePage('testid', req);

        const payload = (api.put as any).mock.calls[0][1];
        expect(payload.tags_to_add).toEqual([]);
        expect(payload.tags_to_delete).toEqual([]);
    });
});