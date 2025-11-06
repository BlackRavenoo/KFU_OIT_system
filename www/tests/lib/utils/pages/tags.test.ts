import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/utils/auth/types', () => ({
    UserRole: { User: 1, Moderator: 2, Administrator: 3, Programmer: 4 }
}));

vi.mock('$lib/utils/auth/storage/initial', () => {
    const { writable } = require('svelte/store');
    const currentUser = writable({ role: 3 });
    return { currentUser };
});

vi.mock('$lib/utils/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

import { fetchTags, createTagIfAllowed, addTagFromSuggestion, removeTag, type ServerTagDto } from '$lib/utils/pages/tags';
import { api } from '$lib/utils/api';
import { currentUser } from '$lib/utils/auth/storage/initial';
import { UserRole } from '$lib/utils/auth/types';

describe('Tags for pages', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        currentUser.set({ role: UserRole.Administrator } as any);
    });

    describe('fetchTags', () => {
        it("Returns [] and doesn't call API when query is empty", async () => {
            const r1 = await fetchTags('');
            const r2 = await fetchTags('   ');
            const r3 = await fetchTags((undefined as unknown) as string);
            expect(r1).toEqual([]);
            expect(r2).toEqual([]);
            expect(r3).toEqual([]);
            expect(api.get).not.toHaveBeenCalled();
        });

        it('Returns [] when server data is not an array', async () => {
            (api.get as any).mockResolvedValue({ data: { any: 'thing' } });
            const res = await fetchTags('x');
            expect(api.get).toHaveBeenCalledWith('/api/v1/tags/?q=x');
            expect(res).toEqual([]);
        });

        it('Filters items from server array', async () => {
            (api.get as any).mockResolvedValue({
                data: [
                    { id: 1, name: 'A' },
                    { id: '2', name: 'B' },
                    { id: null, name: 'C' },
                    { name: 'NoId' },
                    { id: 3, name: '' },
                    { id: 4 },
                    null,
                    undefined
                ]
            });

            const res = await fetchTags(' Hello+World ');
            expect(api.get).toHaveBeenCalledWith('/api/v1/tags/?q=Hello%2BWorld');
            expect(res).toEqual([
                { id: 1, name: 'A' },
                { id: 2, name: 'B' }
            ]);
        });
    });

    describe('createTagIfAllowed', () => {
        it('Throws on empty name', async () => {
            await expect(createTagIfAllowed('')).rejects.toThrow('Empty tag name');
            await expect(createTagIfAllowed('   ')).rejects.toThrow('Empty tag name');
            expect(api.post).not.toHaveBeenCalled();
        });

        it('Throws on insufficient role', async () => {
            currentUser.set({ role: UserRole.Programmer } as any);
            await expect(createTagIfAllowed('Test')).rejects.toThrow('Forbidden: insufficient role');
            expect(api.post).not.toHaveBeenCalled();
        });

        it('Throws on non-2xx status', async () => {
            currentUser.set({ role: UserRole.Moderator } as any);
            (api.post as any).mockResolvedValue({ status: 500, data: {} });
            await expect(createTagIfAllowed('Tag')).rejects.toThrow('Failed to create tag');
        });

        it('Throws on invalid server payload', async () => {
            currentUser.set({ role: UserRole.Administrator } as any);
            (api.post as any).mockResolvedValue({ status: 200, data: {} });
            await expect(createTagIfAllowed('Tag')).rejects.toThrow('Invalid server response: tag id or name missing');
        });

        it('Returns created tag with coerced id on success', async () => {
            currentUser.set({ role: UserRole.Moderator } as any);
            (api.post as any).mockResolvedValue({ status: 201, data: { id: '10', name: 'Ops' } });

            const created = await createTagIfAllowed('Ops');
            expect(api.post).toHaveBeenCalledWith('/api/v1/tags/', { name: 'Ops', synonyms: [] });
            expect(created).toEqual({ id: 10, name: 'Ops' });
        });

        it('Throws when name is undefined', async () => {
            await expect(createTagIfAllowed((undefined as unknown) as string)).rejects.toThrow('Empty tag name');
            expect(api.post).not.toHaveBeenCalled();
        });
    });

    describe('addTagFromSuggestion', () => {
        it('Returns selected when tag is undefined or lacks id/name', () => {
            const selected: ServerTagDto[] = [{ id: 1, name: 'A' }];
            const s1 = addTagFromSuggestion(selected, (undefined as any), [{ id: 2, name: 'B' }]);
            const s2 = addTagFromSuggestion(selected, { id: 0, name: 'X' } as any, [{ id: 2, name: 'B' }]);
            const s3 = addTagFromSuggestion(selected, { id: 3, name: '' } as any, [{ id: 3, name: '' } as any]);
            expect(s1).toBe(selected);
            expect(s2).toBe(selected);
            expect(s3).toBe(selected);
        });

        it('Returns selected when suggestions is not an array or tag not present there', () => {
            const selected: ServerTagDto[] = [{ id: 1, name: 'A' }];
            const s1 = addTagFromSuggestion(selected, { id: 2, name: 'B' }, (undefined as any));
            const s2 = addTagFromSuggestion(selected, { id: 2, name: 'B' }, [{ id: 3, name: 'C' }]);
            expect(s1).toBe(selected);
            expect(s2).toBe(selected);
        });

        it('Returns selected when tag already selected', () => {
            const selected: ServerTagDto[] = [{ id: 2, name: 'B' }];
            const out = addTagFromSuggestion(selected, { id: 2, name: 'B' }, [{ id: 2, name: 'B' }]);
            expect(out).toBe(selected);
        });

        it('Adds tag immutably when valid and not selected', () => {
            const selected: ServerTagDto[] = [{ id: 1, name: 'A' }];
            const out = addTagFromSuggestion(selected, { id: 2, name: 'B' }, [{ id: 2, name: 'B' }]);
            expect(out).toEqual([
                { id: 1, name: 'A' },
                { id: 2, name: 'B' }
            ]);
            expect(out).not.toBe(selected);
        });
    });

    describe('removeTag', () => {
        it('Returns same array when id is falsy', () => {
            const selected: ServerTagDto[] = [{ id: 1, name: 'A' }];
            const out = removeTag(selected, 0);
            expect(out).toBe(selected);
        });

        it('Removes by id immutably', () => {
            const selected: ServerTagDto[] = [
                { id: 1, name: 'A' },
                { id: 2, name: 'B' },
                { id: 3, name: 'C' }
            ];
            const out = removeTag(selected, 2);
            expect(out).toEqual([
                { id: 1, name: 'A' },
                { id: 3, name: 'C' }
            ]);
            expect(out).not.toBe(selected);
        });
    });
});