import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('$lib/utils/api', () => ({ api: { get: vi.fn() } }));

import { fetchRelated, addRelated, removeRelated, createDebouncedRelatedSearch } from '$lib/utils/pages/related';
import { api } from '$lib/utils/api';

describe('Related pages', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('fetchRelated', () => {
        it('Returns [] on empty or whitespace-only query', async () => {
            const r1 = await fetchRelated('');
            const r2 = await fetchRelated('   ');
            expect(r1).toEqual([]);
            expect(r2).toEqual([]);
            expect(api.get).not.toHaveBeenCalled();
        });

        it('Calls API with encoded query and maps array data', async () => {
            (api.get as any).mockResolvedValue({
                data: [
                    { id: 1, title: 'A' },
                    { uuid: '550e8400-e29b-41d4-a716-446655440000', name: 'B' },
                    { id: 0, name: 'No title' },
                    { title: 'No id' },
                    null,
                ]
            });

            const res = await fetchRelated(' Hello World+/ ');
            expect(api.get).toHaveBeenCalledTimes(1);
            expect(api.get).toHaveBeenCalledWith('/api/v1/related/?q=Hello%20World%2B%2F');

            expect(res).toEqual([
                { id: '1', title: 'A' },
                { id: '550e8400-e29b-41d4-a716-446655440000', title: 'B' }
            ]);
        });

        it('Maps results when data is not an array', async () => {
            (api.get as any).mockResolvedValue({
                data: {
                    results: [
                        { id: '9', title: 'T9' },
                        { uuid: 777, name: 'N777' },
                        { uuid: 888 },
                    ],
                    extra: true
                }
            });

            const res = await fetchRelated('x');
            expect(res).toEqual([
                { id: '9', title: 'T9' },
                { id: '777', title: 'N777' }
            ]);
        });

        it('Returns [] when response has no data or invalid shape', async () => {
            (api.get as any).mockResolvedValue({});
            const r1 = await fetchRelated('q1');
            expect(r1).toEqual([]);

            (api.get as any).mockResolvedValue({ data: 123 });
            const r2 = await fetchRelated('q2');
            expect(r2).toEqual([]);
        });

        it('Returns [] on API error (catch branch)', async () => {
            (api.get as any).mockRejectedValue(new Error('network'));
            const res = await fetchRelated('q');
            expect(res).toEqual([]);
        });

        it("Returns [] and doesn't call API", async () => {
            const r1 = await fetchRelated('');
            const r2 = await fetchRelated('   ');
            const r3 = await fetchRelated((undefined as unknown) as string);

            expect(r1).toEqual([]);
            expect(r2).toEqual([]);
            expect(r3).toEqual([]);
            expect(api.get).not.toHaveBeenCalled();
        });
    });

    describe('addRelated', () => {
        it('Returns the same array when item is undefined', () => {
            const selected = [{ id: '1', title: 'A' }];
            const out = addRelated(selected, undefined);
            expect(out).toBe(selected);
        });

        it('Does not add duplicates and returns same reference', () => {
            const selected = [{ id: '1', title: 'A' }];
            const out = addRelated(selected, { id: '1', title: 'A' });
            expect(out).toBe(selected);
            expect(out).toEqual([{ id: '1', title: 'A' }]);
        });

        it('Adds new item immutably', () => {
            const selected = [{ id: '1', title: 'A' }];
            const out = addRelated(selected, { id: '2', title: 'B' });
            expect(out).not.toBe(selected);
            expect(out).toEqual([
                { id: '1', title: 'A' },
                { id: '2', title: 'B' }
            ]);
        });
    });

    describe('removeRelated', () => {
        it('Removes item by id immutably', () => {
            const selected = [
                { id: '1', title: 'A' },
                { id: '2', title: 'B' },
                { id: '3', title: 'C' }
            ];
            const out = removeRelated(selected, '2');
            expect(out).not.toBe(selected);
            expect(out).toEqual([
                { id: '1', title: 'A' },
                { id: '3', title: 'C' }
            ]);
        });

        it('Returns new array even when id not found', () => {
            const selected = [{ id: '1', title: 'A' }];
            const out = removeRelated(selected, '999');
            expect(out).not.toBe(selected);
            expect(out).toEqual([{ id: '1', title: 'A' }]);
        });
    });

    describe('createDebouncedRelatedSearch', () => {
        beforeEach(() => vi.useFakeTimers());
        afterEach(() => vi.useRealTimers());

        it('Debounces calls with default delay', () => {
            const cb = vi.fn();
            const debounced = createDebouncedRelatedSearch(cb);

            debounced('a');
            debounced('b');
            debounced('c');

            expect(cb).not.toHaveBeenCalled();
            vi.advanceTimersByTime(249);
            expect(cb).not.toHaveBeenCalled();
            vi.advanceTimersByTime(1);
            expect(cb).toHaveBeenCalledTimes(1);
            expect(cb).toHaveBeenCalledWith('c');
        });

        it('Respects custom delay', () => {
            const cb = vi.fn();
            const debounced = createDebouncedRelatedSearch(cb, 100);

            debounced('x');
            vi.advanceTimersByTime(100);
            expect(cb).toHaveBeenCalledTimes(1);
            expect(cb).toHaveBeenCalledWith('x');

            debounced('y');
            vi.advanceTimersByTime(99);
            expect(cb).toHaveBeenCalledTimes(1);
            vi.advanceTimersByTime(1);
            expect(cb).toHaveBeenCalledTimes(2);
            expect(cb).toHaveBeenLastCalledWith('y');
        });
    });
});