import { describe, it, expect } from 'vitest';
import { normalizeDate, buildQuery, toRfc3339 } from '$lib/utils/tickets/support';

describe('Tickets support', () => {
    describe('normalizeDate', () => {
        it('Normalize date correctly', () => {
            const date = new Date('2023-10-01').toISOString();
            const expected = date.replace(/\.\d{3}Z$/, 'Z');
            expect(normalizeDate(date)).toBe(expected);
        });

        it('Return null for null', () => {
            //@ts-ignore
            expect(normalizeDate(null)).toBe(null);
        });

        it('Return null for undefined', () => {
            //@ts-ignore
            expect(normalizeDate(undefined)).toBe(null);
        });

        it('Handles date at the turn of the year', () => {
            const date = new Date('2023-12-31T23:59:59Z').toISOString();
            const expected = date.replace(/\.\d{3}Z$/, 'Z');
            expect(normalizeDate(date)).toBe(expected);
        });

        it('Returns date as is when it already matches the format', () => {
            const date = '2023-12-31T23:59:59Z';
            expect(normalizeDate(date)).toBe(date);
        });

        it('Returns date as is when it has timezone offset', () => {
            const date = '2023-12-31T23:59:59+03:00';
            const expected = new Date(date).toISOString().replace(/\.\d{3}Z$/, 'Z');
            expect(normalizeDate(date)).toBe(expected);
        });

        it('Handles leap year', () => {
            const date = new Date('2024-02-29').toISOString();
            const expected = date.replace(/\.\d{3}Z$/, 'Z');
            expect(normalizeDate(date)).toBe(expected);
        });

        it('Parses local datetime without timezone and converts to UTC', () => {
            const input = '2023-10-01 14:30:45';
            const expectedDate = new Date(2023, 9, 1, 14, 30, 45);
            const expected = expectedDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
            expect(normalizeDate(input)).toBe(expected);
        });

        it('Parses local datetime without seconds and defaults to 0 seconds', () => {
            const input = '2023-10-01 14:30';
            const expectedDate = new Date(2023, 9, 1, 14, 30, 0);
            const expected = expectedDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
            expect(normalizeDate(input)).toBe(expected);
        });

        it('Adds missing seconds to datetime with timezone when seconds are not present', () => {
            const input = '2023-10-01T14:30+03:00';
            const expected = new Date('2023-10-01T14:30:00+03:00').toISOString().replace(/\.\d{3}Z$/, 'Z');
            expect(normalizeDate(input)).toBe(expected);
        });

        it('Returns null for invalid datetime with timezone that cannot be parsed', () => {
            const input = '2023-13-45T25:99:99+03:00';
            expect(normalizeDate(input)).toBe(null);
        });

        it('Returns null for completely invalid date string that fails all patterns', () => {
            const input = 'not-a-valid-date-at-all';
            expect(normalizeDate(input)).toBe(null);
        });
    });

    describe('toRfc3339', () => {
        it('Format to RFC3339', () => {
            const date = new Date('2023-10-01').toISOString();
            expect(toRfc3339(date)).toBe('2023-10-01T00:00:00Z');
        });

        it('Format to RFC3339 with end of day', () => {
            const date = new Date('2023-10-01').toISOString();
            expect(toRfc3339(date, true)).toBe('2023-10-01T23:59:59Z');
        });

        it('Return empty string for null', () => {
            //@ts-ignore
            expect(toRfc3339(null)).toBe('');
        });

        it('Return empty string for undefined', () => {
            //@ts-ignore
            expect(toRfc3339(undefined)).toBe('');
        });

        it('Handles invalid datsze format', () => {
            const result = toRfc3339('invalid-date');
            expect(result).toBe('');
        });

        it('Handles date string without T character', () => {
            const dateString = '2023-10-01';
            expect(toRfc3339(dateString)).toBe('2023-10-01T00:00:00Z');
        });

        it('Handles date string with T character', () => {
            const dateString = '2023-10-01T12:30:45Z';
            expect(toRfc3339(dateString)).toBe('2023-10-01T00:00:00Z');
        });

        it('Properly formats date string with different formats', () => {
            expect(toRfc3339('10/01/2023')).toBe('10/01/2023T00:00:00Z');
            expect(toRfc3339('2023.10.01')).toBe('2023.10.01T00:00:00Z');
        });
    });

    describe('buildQuery', () => {
        it('Build query string from parameters object', () => {
            const params = { search: 'test', page: 1 };
            expect(buildQuery(params)).toBe('search=test&page=1');
        });

        it('Handles empty object', () => {
            expect(buildQuery({})).toBe('');
        });

        it('Handles null parameters', () => {
            const params = { search: null, page: 1 };
            expect(buildQuery(params)).toBe('search=null&page=1');
        });

        it('Handles undefined parameters', () => {
            const params = { search: undefined, page: 1 };
            expect(buildQuery(params)).toBe('search=undefined&page=1');
        });

        it('Handles special characters', () => {
            const params = { search: 'test with spaces', filter: 'a&b=c' };
            expect(buildQuery(params)).toBe('search=test%20with%20spaces&filter=a%26b%3Dc');
        });

        it('Handles numeric values', () => {
            const params = { id: 123, rating: 4.5 };
            expect(buildQuery(params)).toBe('id=123&rating=4.5');
        });

        it('Handles boolean values', () => {
            const params = { active: true, completed: false };
            expect(buildQuery(params)).toBe('active=true&completed=false');
        });

        it('Handles arrays', () => {
            const params = { ids: [1, 2, 3] };
            expect(buildQuery(params)).toBe('ids[]=1&ids[]=2&ids[]=3');
        });
    });
});