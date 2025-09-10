import { it, expect, describe } from 'vitest';
import { AUTH_BASE_PATH, TICKETS_API_ENDPOINTS } from '$lib/utils/tickets/api/endpoints';
import type { TicketsApiEndpoints } from '$lib/utils/tickets/types';

describe('TICKETS_API_ENDPOINTS', () => {
    it('Should have correct structure', () => {
        const expectedKeys = ['create', 'read', 'update', 'delete', 'consts', 'attachments'];
        expect(Object.keys(TICKETS_API_ENDPOINTS)).toEqual(expectedKeys);
    });

    it('Should have correct base path structure', () => {
        expect(AUTH_BASE_PATH).toMatch(/^\/[\w\/\-._~:?#[\]@!$&'()*+,;=]*$/);
    });
});