import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { toKey, getWeekRange, buildDays, loadTicketsForRange } from '$lib/components/Calendar/Calendar';
import type { Ticket } from '$lib/utils/tickets/types';

let fetchTickets: Mock;
let normalizeDate: Mock;

vi.mock('$lib/utils/tickets/api/get', () => {
    return {
        fetchTickets: vi.fn()
    };
});

vi.mock('$lib/utils/tickets/support', () => {
    return {
        normalizeDate: vi.fn()
    };
});

beforeEach(async () => {
    vi.resetAllMocks();
    const api = await import('$lib/utils/tickets/api/get');
    const support = await import('$lib/utils/tickets/support');
    fetchTickets = api.fetchTickets as unknown as Mock;
    normalizeDate = support.normalizeDate as unknown as Mock;
});

afterEach(() => {
    vi.clearAllTimers();
    vi.resetAllMocks();
});

function pad(n: number) {
    return String(n).padStart(2, '0');
}

describe('toKey', () => {
    it('Contains zero-padded day, month and full year', () => {
        const d = new Date('2024-01-02T00:00:00Z');
        const r = toKey(d);
        expect(r).toContain(String(d.getFullYear()));
        expect(r).toContain(pad(d.getMonth() + 1));
        expect(r).toContain(pad(d.getDate()));
        expect(/^\d{2}[-/]\d{2}[-/]\d{4}$|^\d{4}[-/]\d{2}[-/]\d{2}$/.test(r)).toBe(true);
    }); 

    it('Contains correct components for end-of-year', () => {
        const d = new Date('1999-12-31T00:00:00Z');
        const r = toKey(d);
        expect(r).toContain('1999');
        expect(r).toContain('12');
        expect(r).toContain('31');
        expect(/^\d{2}[-/]\d{2}[-/]\d{4}$|^\d{4}[-/]\d{2}[-/]\d{2}$/.test(r)).toBe(true);
    });
});

describe('getWeekRange', () => {
    it('Returns Monday..Sunday for a Wednesday', () => {
        const center = new Date('2024-01-03');
        const { start, end } = getWeekRange(center);
        const startKey = toKey(start);
        const endKey = toKey(end);
        expect(startKey).toBe(toKey(new Date('2024-01-01')));
        expect(endKey).toBe(toKey(new Date('2024-01-07')));
    }); 

    it('Returns same Monday when center is Monday', () => {
        const center = new Date('2024-01-01');
        const { start, end } = getWeekRange(center);
        expect(toKey(start)).toBe(toKey(new Date('2024-01-01')));
        expect(toKey(end)).toBe(toKey(new Date('2024-01-07')));
    }); 
    
    it('Handles Sunday center correctly', () => {
        const center = new Date('2024-01-07');
        const { start, end } = getWeekRange(center);
        expect(toKey(start)).toBe(toKey(new Date('2024-01-01')));
        expect(toKey(end)).toBe(toKey(new Date('2024-01-07')));
    });
});

describe('buildDays', () => {
    it('Returns single element when start equals end', () => {
        const d = new Date('2024-02-10');
        const res = buildDays(d, d);
        expect(res).toHaveLength(1);
        expect(toKey(res[0])).toBe(toKey(d));
    }); 

    it('Returns inclusive range', () => {
        const start = new Date('2024-02-10');
        const end = new Date('2024-02-12');
        const res = buildDays(start, end);
        expect(res.map(toKey)).toEqual([toKey(new Date('2024-02-10')), toKey(new Date('2024-02-11')), toKey(new Date('2024-02-12'))]);
    }); 
    
    it('Returns empty array when start > end', () => {
        const start = new Date('2024-02-13');
        const end = new Date('2024-02-12');
        const res = buildDays(start, end);
        expect(res).toHaveLength(0);
    });
});

describe('loadTicketsForRange', () => {
    it('Returns empty object when fetchTickets returns non-array', async () => {
        fetchTickets.mockResolvedValue({ tickets: null });
        normalizeDate.mockReset();    
        const start = new Date('2024-01-01');
        const end = new Date('2024-01-07');   
        const res = await loadTicketsForRange(start, end);
        
        expect(res).toEqual({});
        expect(fetchTickets).toHaveBeenCalledTimes(1);
        
        const calledOpts = fetchTickets.mock.calls[0][1];
        
        expect(calledOpts).toHaveProperty('planned_from', start.toISOString());
        expect(calledOpts).toHaveProperty('planned_to', end.toISOString());
        expect(calledOpts).toHaveProperty('page_size', 100);
    }); 

    it('Groups tickets by normalized date', async () => {
        const ticket = { id: 1, planned_at: 'p1' } as unknown as Ticket;

        fetchTickets.mockResolvedValue({ tickets: [ticket] });
        normalizeDate.mockImplementation((v: string) => {
            if (v === 'p1') return '2024-01-02T10:00:00Z';
            return '';
        });

        const res = await loadTicketsForRange(new Date('2024-01-01'), new Date('2024-01-07'));
        const key = toKey(new Date('2024-01-02T10:00:00Z'));
        
        expect(Object.keys(res)).toHaveLength(1);
        expect(res[key]).toHaveLength(1);
        expect(res[key][0].id).toBe(1);
    }); 

    it('Uses created_at when planned_at missing', async () => {
        const ticket = { id: 2, created_at: 'c1' } as unknown as Ticket;
        
        fetchTickets.mockResolvedValue({ tickets: [ticket] });
        normalizeDate.mockImplementation((v: string) => {
            if (v === 'c1') return '2024-03-05T00:00:00Z';
            return '';
        });   
        
        const res = await loadTicketsForRange(new Date('2024-03-01'), new Date('2024-03-10'));
        const key = toKey(new Date('2024-03-05T00:00:00Z'));
        
        expect(res[key]).toHaveLength(1);
        expect(res[key][0].id).toBe(2);
    }); 

    it('Skips tickets when normalizeDate returns falsy', async () => {
        const good = { id: 3, planned_at: 'ok' } as unknown as Ticket;
        const bad = { id: 4, planned_at: 'bad' } as unknown as Ticket;
        
        fetchTickets.mockResolvedValue({ tickets: [good, bad] });
        normalizeDate.mockImplementation((v: string) => {
            if (v === 'ok') return '2024-04-01T00:00:00Z';
            return '';
        });   
        
        const res = await loadTicketsForRange(new Date('2024-04-01'), new Date('2024-04-30'));
        const key = toKey(new Date('2024-04-01T00:00:00Z'));
        
        expect(res[key]).toHaveLength(1);
        expect(res[key][0].id).toBe(3);
        expect(Object.values(res).flat().map(t => t.id)).not.toContain(4);
    }); 

    it('Skips tickets with invalid Date after normalizeDate', async () => {
        const t1 = { id: 5, planned_at: 'v1' } as unknown as Ticket;
        const t2 = { id: 6, planned_at: 'v2' } as unknown as Ticket;
        
        fetchTickets.mockResolvedValue({ tickets: [t1, t2] });
        normalizeDate.mockImplementation((v: string) => {
            if (v === 'v1') return 'invalid-date';
            if (v === 'v2') return '2024-05-10T12:00:00Z';
            return '';
        });   
        
        const res = await loadTicketsForRange(new Date('2024-05-01'), new Date('2024-05-31'));
        const key = toKey(new Date('2024-05-10T12:00:00Z'));
        
        expect(res[key]).toHaveLength(1);
        expect(res[key][0].id).toBe(6);
    }); 

    it('Groups multiple tickets on same normalized date', async () => {
        const a = { id: 7, planned_at: 'a' } as unknown as Ticket;
        const b = { id: 8, created_at: 'a' } as unknown as Ticket;
        
        fetchTickets.mockResolvedValue({ tickets: [a, b] });
        normalizeDate.mockReturnValue('2024-06-02T00:00:00Z');    
        
        const res = await loadTicketsForRange(new Date('2024-06-01'), new Date('2024-06-07'));
        const key = toKey(new Date('2024-06-02T00:00:00Z'));
        
        expect(res[key]).toHaveLength(2);
        expect(res[key].map(t => t.id).sort()).toEqual([7, 8]);
    });

    it('Calls normalizeDate with empty string and skips the ticket', async () => {
        const ticket = { id: 9 } as unknown as Ticket;

        fetchTickets.mockResolvedValue({ tickets: [ticket] });      
        normalizeDate.mockClear();
        normalizeDate.mockImplementation((v: string) => {
          expect(v).toBe('');
          return '';
        });     

        const res = await loadTicketsForRange(new Date('2024-07-01'), new Date('2024-07-07'));

        expect(normalizeDate).toHaveBeenCalled();
        expect(res).toEqual({});
    });
});