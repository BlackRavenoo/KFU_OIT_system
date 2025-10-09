import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/utils/api', () => ({
    api: {
        post: vi.fn()
    }
}));

describe('Confirmation token validation', () => {
beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
});

    it('returns true when API responds with success', async () => {
        const { api } = await import('$lib/utils/api');
        (api.post as any).mockResolvedValue({
            success: true,
            data: { valid: true }
        });

        const { checkConfirmationToken } = await import('$lib/utils/auth/tokens/confirmation');
        const result = await checkConfirmationToken('valid-token-123');

        expect(api.post).toHaveBeenCalledWith('/api/v1/auth/validate', { token: 'valid-token-123' });
        expect(result).toBe(true);
    });

    it('returns false when API responds with success false', async () => {
        const { api } = await import('$lib/utils/api');
        (api.post as any).mockResolvedValue({
            success: false,
            data: { valid: false }
        });

        const { checkConfirmationToken } = await import('$lib/utils/auth/tokens/confirmation');
        const result = await checkConfirmationToken('invalid-token-456');

        expect(api.post).toHaveBeenCalledWith('/api/v1/auth/validate', { token: 'invalid-token-456' });
        expect(result).toBe(false);
    });

    it('handles API rejection and throws error', async () => {
        const { api } = await import('$lib/utils/api');
        const apiError = new Error('Network error');
        (api.post as any).mockRejectedValue(apiError);

        const { checkConfirmationToken } = await import('$lib/utils/auth/tokens/confirmation');

        await expect(checkConfirmationToken('error-token-789')).rejects.toThrow('Network error');
        expect(api.post).toHaveBeenCalledWith('/api/v1/auth/validate', { token: 'error-token-789' });
    });

    it('works with empty token string', async () => {
        const { api } = await import('$lib/utils/api');
        (api.post as any).mockResolvedValue({
            success: false
        });

        const { checkConfirmationToken } = await import('$lib/utils/auth/tokens/confirmation');
        const result = await checkConfirmationToken('');

        expect(api.post).toHaveBeenCalledWith('/api/v1/auth/validate', { token: '' });
        expect(result).toBe(false);
    });

    it('works with whitespace-only token', async () => {
        const { api } = await import('$lib/utils/api');
        (api.post as any).mockResolvedValue({
            success: true
        });

        const { checkConfirmationToken } = await import('$lib/utils/auth/tokens/confirmation');
        const result = await checkConfirmationToken('   ');

        expect(api.post).toHaveBeenCalledWith('/api/v1/auth/validate', { token: '   ' });
        expect(result).toBe(true);
    });

    it('works with very long token', async () => {
        const { api } = await import('$lib/utils/api');
        (api.post as any).mockResolvedValue({
            success: true
        });

        const longToken = 'a'.repeat(1000);
        const { checkConfirmationToken } = await import('$lib/utils/auth/tokens/confirmation');
        const result = await checkConfirmationToken(longToken);

        expect(api.post).toHaveBeenCalledWith('/api/v1/auth/validate', { token: longToken });
        expect(result).toBe(true);
    });

    it('works with special characters in token', async () => {
        const { api } = await import('$lib/utils/api');
        (api.post as any).mockResolvedValue({
            success: true
        });

        const specialToken = 'token-with-@#$%^&*()_+-={}[]|\\:";\'<>?,./';
        const { checkConfirmationToken } = await import('$lib/utils/auth/tokens/confirmation');
        const result = await checkConfirmationToken(specialToken);

        expect(api.post).toHaveBeenCalledWith('/api/v1/auth/validate', { token: specialToken });
        expect(result).toBe(true);
    });

    it('returns boolean based on success property only', async () => {
        const { api } = await import('$lib/utils/api');
        
        (api.post as any).mockResolvedValueOnce({
            success: true,
            data: { valid: false }
        });

        const { checkConfirmationToken } = await import('$lib/utils/auth/tokens/confirmation');
        const result1 = await checkConfirmationToken('token1');
        expect(result1).toBe(true);

        (api.post as any).mockResolvedValueOnce({
            success: false,
            data: { valid: true }
        });

        const result2 = await checkConfirmationToken('token2');
        expect(result2).toBe(false);
    });

    it('handles response without data property', async () => {
        const { api } = await import('$lib/utils/api');
        (api.post as any).mockResolvedValue({
            success: true
        });

        const { checkConfirmationToken } = await import('$lib/utils/auth/tokens/confirmation');
        const result = await checkConfirmationToken('token-no-data');

        expect(result).toBe(true);
    });

    it('handles null response', async () => {
        const { api } = await import('$lib/utils/api');
        (api.post as any).mockResolvedValue(null);

        const { checkConfirmationToken } = await import('$lib/utils/auth/tokens/confirmation');

        await expect(checkConfirmationToken('null-response-token')).rejects.toThrow();
    });
});