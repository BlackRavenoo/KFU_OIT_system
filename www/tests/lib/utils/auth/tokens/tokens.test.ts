import { vi, describe, it, expect, beforeEach } from 'vitest';

function base64UrlEncodeStr(str: string) {
    const bytes = new TextEncoder().encode(str);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let out = '';
    let i = 0;
    
    for (; i + 2 < bytes.length; i += 3) {
        const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
        out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + chars[(n >> 6) & 63] + chars[n & 63];
    }

    const rem = bytes.length - i;
    if (rem === 1) {
        const n = bytes[i] << 16;
        out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + '==';
    } else if (rem === 2) {
        const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
        out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + chars[(n >> 6) & 63] + '=';
    }
    
    return out.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeJwtWithExp(expMs: number) {
    const header = JSON.stringify({ alg: 'none', typ: 'JWT' });
    const payload = JSON.stringify({ exp: Math.floor(expMs / 1000) });
    return `${base64UrlEncodeStr(header)}.${base64UrlEncodeStr(payload)}.signature`;
}

beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.clearAllMocks();

    if (!globalThis.atob) {
        (globalThis as any).atob = (b64: string) => {
            const b64std = b64.replace(/-/g, '+').replace(/_/g, '/');
            const pad = b64std.length % 4;
            const b64p = b64std + (pad ? '='.repeat(4 - pad) : '');
            const lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
            let bits = 0;
            let value = 0;
            let out = '';
            
            for (let i = 0; i < b64p.length; i++) {
                const ch = b64p[i];
                if (ch === '=') break;
                const idx = lookup.indexOf(ch);
                if (idx === -1) continue;
                
                value = (value << 6) | idx;
                bits += 6;
                
                if (bits >= 8) {
                    bits -= 8;
                    out += String.fromCharCode((value >> bits) & 0xff);
                }
            }
            return out;
        };
    }
});

describe('isTokenValid', () => {
    it('Token with future exp', async () => {
        const { isTokenValid } = await import('$lib/utils/auth/tokens/tokens');
        const token = makeJwtWithExp(Date.now() + 60_000);
        
        expect(isTokenValid(token)).toBe(true);
    });

    it('Expired token', async () => {
        const { isTokenValid } = await import('$lib/utils/auth/tokens/tokens');
        const token = makeJwtWithExp(Date.now() - 60_000);
        
        expect(isTokenValid(token)).toBe(false);
    });

    it('Malformed token', async () => {
        const { isTokenValid } = await import('$lib/utils/auth/tokens/tokens');
        
        expect(isTokenValid('not.a.jwt')).toBe(false);
        expect(isTokenValid('')).toBe(false);
    });

    it('Returns tokens from storage', async () => {
        const tokens = { accessToken: 'a', refreshToken: 'r' };
        
        vi.doMock('$lib/utils/auth/tokens/storage', () => ({
            getTokenStore: () => tokens,
            setTokenStore: () => {},
            clearTokenStore: () => {}
        }));
        
        const mod = await import('$lib/utils/auth/tokens/tokens');
        
        expect(mod.getAuthTokens()).toEqual(tokens);
    });

    it('Throw error', async () => {
        vi.doMock('$lib/utils/auth/tokens/storage', () => ({
            getTokenStore: () => { throw new Error('boom'); },
            setTokenStore: () => {},
            clearTokenStore: () => {}
        }));

        const { checkToken } = await import('$lib/utils/auth/tokens/tokens');
        await expect(checkToken()).resolves.toBe(false);
    });
});

describe('checkToken', () => {
    it('Token exists and valid', async () => {
        const token = makeJwtWithExp(Date.now() + 60_000);
        
        vi.doMock('$lib/utils/auth/tokens/storage', () => ({
            getTokenStore: () => ({ accessToken: token, refreshToken: 'r' }),
            setTokenStore: () => {},
            clearTokenStore: () => {}
        }));
        
        const { checkToken } = await import('$lib/utils/auth/tokens/tokens');
        
        await expect(checkToken()).resolves.toBe(true);
    });

    it('No stored tokens', async () => {
        vi.doMock('$lib/utils/auth/tokens/storage', () => ({
            getTokenStore: () => null,
            setTokenStore: () => {},
            clearTokenStore: () => {}
        }));
        
        const { checkToken } = await import('$lib/utils/auth/tokens/tokens');
        
        await expect(checkToken()).resolves.toBe(false);
    });

    it('Stored token invalid', async () => {
        vi.doMock('$lib/utils/auth/tokens/storage', () => ({
            getTokenStore: () => ({ accessToken: 'invalid', refreshToken: 'r' }),
            setTokenStore: () => {},
            clearTokenStore: () => {}
        }));
        
        const { checkToken } = await import('$lib/utils/auth/tokens/tokens');
        
        await expect(checkToken()).resolves.toBe(false);
    });
});

describe('clearAuthTokens', () => {
    it('Calls setTokenStore', async () => {
        const setSpy = vi.fn();
        
        vi.doMock('$lib/utils/auth/tokens/storage', () => ({
            getTokenStore: () => null,
            setTokenStore: setSpy,
            clearTokenStore: () => {}
        }));
        
        const { clearAuthTokens } = await import('$lib/utils/auth/tokens/tokens');
        clearAuthTokens();
        
        expect(setSpy).toHaveBeenCalledWith(null);
    });
});