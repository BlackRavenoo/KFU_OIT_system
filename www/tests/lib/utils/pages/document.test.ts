import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/utils/api', () => ({ api: { post: vi.fn(), get: vi.fn(), put: vi.fn() } }));
vi.mock('$lib/utils/texteditor/serialize', () => ({
    serialize: vi.fn((html: string) => [{ type: 'text', text: html }]),
    deserialize: vi.fn(() => '<p>DESERIALIZED</p>')
}));

import { savePage, savePageAndGetId, fetchPageContentByKey, updatePage } from '$lib/utils/pages/document';
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

    it('Uses "public" prefix', async () => {
        (api.get as any).mockResolvedValue({ status: 200, data: [{ type: 'text', text: 'Hi' }] });

        const html = await fetchPageContentByKey(true, '/pages/news/hello.json');

        expect(api.get).toHaveBeenCalledTimes(1);
        expect((api.get as any).mock.calls[0][0]).toBe('/api/v1/page/public/news/hello.json');
        expect(deserialize).toHaveBeenCalled();
        expect(html).toBe('<p>DESERIALIZED</p>');
    });

    it('Uses "private" prefix', async () => {
        (api.get as any).mockResolvedValue({ status: 200, data: [{ type: 'text', text: 'Hi' }] });

        const html = await fetchPageContentByKey(false, 'pages/root.json');

        expect(api.get).toHaveBeenCalledTimes(1);
        expect((api.get as any).mock.calls[0][0]).toBe('/api/v1/page/private/root.json');
        expect(html).toBe('<p>DESERIALIZED</p>');
    });

    it('Not change key if it does not start with /pages/', async () => {
        (api.get as any).mockResolvedValue({ status: 200, data: [{ type: 'text', text: 'Hi' }] });

        const html = await fetchPageContentByKey(true, 'other/abc.json');

        expect((api.get as any).mock.calls[0][0]).toBe('/api/v1/page/public/other/abc.json');
        expect(html).toBe('<p>DESERIALIZED</p>');
    });

    it('Parses JSON string payload', async () => {
        const payload = JSON.stringify([{ type: 'text', text: 'X' }]);
        (api.get as any).mockResolvedValue({ status: 200, data: payload });

        const html = await fetchPageContentByKey(true, 'pages/x.json');

        expect(deserialize).toHaveBeenCalledWith([{ type: 'text', text: 'X' }]);
        expect(html).toBe('<p>DESERIALIZED</p>');
    });

    it('Returns raw string when server returns non-JSON string', async () => {
        (api.get as any).mockResolvedValue({ status: 200, data: '<p>RAW</p>' });

        const html = await fetchPageContentByKey(true, '/pages/raw.html');

        expect(deserialize).not.toHaveBeenCalled();
        expect(html).toBe('<p>RAW</p>');
    });

    it('Accepts 201/204/304 statuses', async () => {
        (api.get as any).mockResolvedValueOnce({ status: 201, data: [{ t: 1 }] });
        await expect(fetchPageContentByKey(true, 'pages/a.json')).resolves.toBe('<p>DESERIALIZED</p>');

        (api.get as any).mockResolvedValueOnce({ status: 204, data: '[]' });
        await expect(fetchPageContentByKey(false, 'pages/b.json')).resolves.toBe('<p>DESERIALIZED</p>');

        (api.get as any).mockResolvedValueOnce({ status: 304, data: [{ t: 2 }] });
        await expect(fetchPageContentByKey(true, 'pages/c.json')).resolves.toBe('<p>DESERIALIZED</p>');
    });

    it('Throws on non-ok status with server error message', async () => {
        (api.get as any).mockResolvedValue({ status: 500, error: 'oops' });

        await expect(fetchPageContentByKey(true, 'pages/fail.json')).rejects.toThrow('oops');
    });

    it('Throws on non-string and non-array data payload', async () => {
        (api.get as any).mockResolvedValue({ status: 200, data: { a: 1 } });
        await expect(fetchPageContentByKey(true, 'pages/x.json')).rejects.toThrow('Некорректный формат контента');
    });

    it('Throws exactly "HTTP 418" when server returns non-ok status without error', async () => {
        (api.get as any).mockResolvedValue({ status: 418 });
        await expect(fetchPageContentByKey(true, 'pages/any.json')).rejects.toThrow('HTTP 418');
    });

    it('Uses empty string when key is undefined (triggers ?? "")', async () => {
        (api.get as any).mockResolvedValue({ status: 200, data: '<p>OK</p>' });
        const html = await fetchPageContentByKey(true, undefined as any);
        expect((api.get as any).mock.calls[0][0]).toBe('/api/v1/page/public/');
        expect(html).toBe('<p>OK</p>');
    });
});

describe('updatePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (serialize as any).mockImplementation((html: string) => [{ type: 'text', text: html }]);
    });

    it('succeeds on 200 status and sends correct payload', async () => {
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
            tags: [1, 2],
            related: [5, 6],
            is_public: true
        });
    });

    it.each([200, 201, 204])('accepts status %i as success', async (status) => {
        (api.put as any).mockResolvedValue({ status });
        await expect(updatePage('9', { html: '<p>x</p>', title: 'T', tags: [], related: [] })).resolves.toBeUndefined();
    });

    it('encodes id in URL', async () => {
        (api.put as any).mockResolvedValue({ status: 200 });
        await updatePage('a b/§', { html: '', title: '', tags: [], related: [] });
        expect((api.put as any).mock.calls[0][0]).toBe('/api/v1/pages/' + encodeURIComponent('a b/§'));
    });

    it('throws when response is undefined', async () => {
        (api.put as any).mockResolvedValue(undefined);
        await expect(updatePage('1', { html: '', title: '', tags: [], related: [] })).rejects.toThrow('Failed to update page');
    });

    it('throws when status is not a number', async () => {
        (api.put as any).mockResolvedValue({ status: 'ok' });
        await expect(updatePage('1', { html: '', title: '', tags: [], related: [] })).rejects.toThrow('Failed to update page');
    });

    it('throws on non-2xx/204 status', async () => {
        (api.put as any).mockResolvedValue({ status: 500, error: 'server' });
        await expect(updatePage('1', { html: '', title: '', tags: [], related: [] })).rejects.toThrow('Failed to update page');
    });

    it('uses [] when req.tags is undefined (triggers ?? [])', async () => {
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
        expect(payload.tags).toEqual([]);
    });

    it('uses [] when req.related is undefined (triggers ?? [])', async () => {
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
        expect(payload.related).toEqual([]);
    });
});