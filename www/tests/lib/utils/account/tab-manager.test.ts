import { vi, describe, it, expect } from 'vitest';

describe('Tab manager', () => {
    it('Update url params successfully', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const gotoMock = vi.fn();
        vi.doMock('$app/environment', () => ({ browser: true }));
        vi.doMock('$app/navigation', () => ({ goto: gotoMock }));

        (globalThis as any).window = { location: { href: 'http://localhost:3000/account?foo=bar' } };

        const { updateUrlParam } = await import('$lib/utils/account/tab-manager');
        updateUrlParam('bots');

        expect(gotoMock).toHaveBeenCalledWith(expect.stringContaining('tab=bots'), { replaceState: true, keepFocus: true });
    });

    it('Update url params when browser=false', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        const gotoMock = vi.fn();
        vi.doMock('$app/environment', () => ({ browser: false }));
        vi.doMock('$app/navigation', () => ({ goto: gotoMock }));

        (globalThis as any).window = { location: { href: 'http://localhost:3000/account' } };

        const { updateUrlParam } = await import('$lib/utils/account/tab-manager');
        updateUrlParam('users');

        expect(gotoMock).not.toHaveBeenCalled();
    });

    it('Recognizing valid and invalid tabs', async () => {
        vi.resetModules();
        vi.clearAllMocks();

        vi.doMock('$app/environment', () => ({ browser: false }));
        vi.doMock('$app/navigation', () => ({ goto: vi.fn() }));

        const mod = await import('$lib/utils/account/tab-manager');
        const { isValidTab, Tab } = mod as any;

        for (const t of Object.values(Tab))
            expect(isValidTab(t)).toBe(true);

        expect(isValidTab('not-a-tab')).toBe(false);
        expect(isValidTab('')).toBe(false);
    });
});