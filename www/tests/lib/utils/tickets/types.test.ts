import { describe, it, expect } from 'vitest';
import { orderByMap, statusOptions, statusPriority } from '$lib/utils/tickets/types';

describe('Tickets types', () => {
    it('orderByMap', () => {
        expect(orderByMap[0]).toBe('id');
        expect(orderByMap[1]).toBe('plannedat');
        expect(orderByMap[2]).toBe('priority');
        expect(Object.keys(orderByMap).length).toBe(3);
    });

    it('statusOptions', () => {
        expect(statusOptions.length).toBe(5);
        expect(statusOptions.map(option => option.value)).toEqual([
            'all', 'open', 'inprogress', 'closed', 'cancelled'
        ]);

        statusOptions.forEach(option => {
            expect(option).toHaveProperty('value');
            expect(option).toHaveProperty('label');
            expect(option).toHaveProperty('serverValue');
            expect(typeof option.value).toBe('string');
            expect(typeof option.label).toBe('string');
        });
    });

    it('statusPriority', () => {
        expect(statusPriority.length).toBe(3);
        
        const priorities = statusPriority.map(option => option.value);
        expect(priorities).toContain('low');
        expect(priorities).toContain('medium');
        expect(priorities).toContain('high');
        
        statusPriority.forEach(option => {
            expect(option.value).toBe(option.serverValue);
        });
    });
});