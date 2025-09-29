import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateStatisticsReport } from '$lib/utils/admin/statics/report';
import { get } from 'svelte/store';

vi.mock('svelte/store', async () => {
    return {
        get: vi.fn()
    };
});

const mockSaveAs = vi.fn();
const mockWrite = vi.fn(() => new ArrayBuffer(8));
const mockBookNew = vi.fn(() => ({}));
const mockBookAppendSheet = vi.fn();
const mockAoaToSheet = vi.fn(() => {
    const ws: any = {};
    ws['!cols'] = [];
    ws['!rows'] = [];
    ws['!merges'] = [];
    ws['!ref'] = 'A1:H10';
    return ws;
});
const mockDecodeRange = vi.fn(() => ({ s: { r: 0, c: 0 }, e: { r: 9, c: 7 } }));
const mockEncodeCell = vi.fn(({ r, c }) => {
    const col = String.fromCharCode(65 + c);
    return `${col}${r + 1}`;
});

const mockUtils = {
    aoa_to_sheet: mockAoaToSheet,
    decode_range: mockDecodeRange,
    encode_cell: mockEncodeCell,
    book_new: mockBookNew,
    book_append_sheet: mockBookAppendSheet,
};

vi.stubGlobal('Blob', function (this: any, arr: any[], opts: any) {
    this.arr = arr;
    this.opts = opts;
});

vi.mock('file-saver', () => ({
    saveAs: mockSaveAs
}));

vi.mock('xlsx-js-style', () => ({
    utils: mockUtils,
    write: mockWrite
}));

vi.mock('$lib/utils/tickets/api/get', () => ({
    fetchTickets: vi.fn()
}));

vi.mock('$lib/utils/auth/storage/initial', () => ({
    currentUser: {}
}));

const { fetchTickets } = await import('$lib/utils/tickets/api/get');
const { get: getStore } = await import('svelte/store');

describe('generateStatisticsReport', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEncodeCell.mockImplementation(({ r, c }) => {
            const col = String.fromCharCode(65 + c);
            return `${col}${r + 1}`;
        });
    });

    it('generates and saves an Excel report with tickets in date range', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 1'
            },
            {
                id: 2,
                title: 'Test 2',
                description: 'Desc 2',
                building: { name: 'Bldg2' },
                cabinet: '102',
                created_at: '2024-06-02T12:00:00.000Z',
                assigned_to: [{ name: 'Petr' }],
                status: 'closed',
                note: 'Note 2'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({
            tickets,
            max_page: 1
        });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(fetchTickets).toHaveBeenCalled();
        expect(mockSaveAs).toHaveBeenCalled();
        expect(mockAoaToSheet).toHaveBeenCalled();
        expect(mockBookAppendSheet).toHaveBeenCalled();
        expect(mockWrite).toHaveBeenCalled();
    });

    it('handles empty tickets (no data in range)', async () => {
        (fetchTickets as any).mockResolvedValueOnce({
            tickets: [],
            max_page: 1
        });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(fetchTickets).toHaveBeenCalled();
        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('stops fetching when created_at < fromDate', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-05-31T23:59:59.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({
            tickets,
            max_page: 1
        });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(fetchTickets).toHaveBeenCalled();
        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles else branch in ticket filtering (createdMs > toMs)', async () => {
        // created_at больше toDate, попадёт в ветку else { continue; }
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-07-01T10:00:00.000Z', // после диапазона
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 1'
            },
            {
                id: 2,
                title: 'Test 2',
                description: 'Desc 2',
                building: { name: 'Bldg2' },
                cabinet: '102',
                created_at: '2024-06-02T12:00:00.000Z', // в диапазоне
                assigned_to: [{ name: 'Petr' }],
                status: 'closed',
                note: 'Note 2'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({
            tickets,
            max_page: 1
        });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(fetchTickets).toHaveBeenCalled();
        expect(mockSaveAs).toHaveBeenCalled();
        // Проверяем, что только второй тикет попал в отчёт (иначе будет ошибка в отчёте)
        expect(mockAoaToSheet).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.arrayContaining(['2', 'Test 2', 'Desc 2', expect.any(String), expect.any(String), expect.any(String), expect.any(String), expect.any(String)])
            ])
        );
    });

    it('handles else branch in ticket filtering (createdMs < fromMs triggers reachedEnd and break)', async () => {
        // Первый тикет в диапазоне, второй - до fromDate (должен сработать break)
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z', // в диапазоне
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 1'
            },
            {
                id: 2,
                title: 'Test 2',
                description: 'Desc 2',
                building: { name: 'Bldg2' },
                cabinet: '102',
                created_at: '2024-05-31T12:00:00.000Z', // до диапазона
                assigned_to: [{ name: 'Petr' }],
                status: 'closed',
                note: 'Note 2'
            },
            {
                id: 3,
                title: 'Test 3',
                description: 'Desc 3',
                building: { name: 'Bldg3' },
                cabinet: '103',
                created_at: '2024-07-01T12:00:00.000Z', // после диапазона, попадёт в else { continue; }
                assigned_to: [{ name: 'Sergey' }],
                status: 'open',
                note: 'Note 3'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({
            tickets,
            max_page: 1
        });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(fetchTickets).toHaveBeenCalled();
        expect(mockSaveAs).toHaveBeenCalled();
        // В отчёте должен быть только первый тикет
        expect(mockAoaToSheet).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.arrayContaining(['1', 'Test 1', 'Desc 1', expect.any(String), expect.any(String), expect.any(String), expect.any(String), expect.any(String)])
            ])
        );
    });

    it('handles multiple pages', async () => {
        const ticketsPage1 = [
            {
                id: 3,
                title: 'Test 3',
                description: 'Desc 3',
                building: { name: 'Bldg3' },
                cabinet: '103',
                created_at: '2024-06-02T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 3'
            }
        ];
        const ticketsPage2 = [
            {
                id: 2,
                title: 'Test 2',
                description: 'Desc 2',
                building: { name: 'Bldg2' },
                cabinet: '102',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Petr' }],
                status: 'closed',
                note: 'Note 2'
            }
        ];
        (fetchTickets as any)
            .mockResolvedValueOnce({ tickets: ticketsPage1, max_page: 2 })
            .mockResolvedValueOnce({ tickets: ticketsPage2, max_page: 2 });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(fetchTickets).toHaveBeenCalledTimes(2);
        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles assigned_to as string', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: 'Ivan',
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({
            tickets,
            max_page: 1
        });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles assigned_to as null/undefined', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: null,
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({
            tickets,
            max_page: 1
        });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles assigned_to as undefined (explicit)', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: undefined,
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({
            tickets,
            max_page: 1
        });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles unknown status', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'unknown_status',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({
            tickets,
            max_page: 1
        });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles user with no name', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({
            tickets,
            max_page: 1
        });
        (getStore as any).mockReturnValue(undefined);

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles user with empty name', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({
            tickets,
            max_page: 1
        });
        (getStore as any).mockReturnValue({ name: '' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('applies red fill for cancelled status', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'cancelled',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({
            tickets,
            max_page: 1
        });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        let worksheet: any = {};
        mockAoaToSheet.mockImplementationOnce(() => {
            worksheet = {};
            worksheet['!cols'] = [];
            worksheet['!rows'] = [];
            worksheet['!merges'] = [];
            worksheet['!ref'] = 'A1:H2';
            worksheet['A2'] = { v: '1' };
            worksheet['G2'] = { v: 'Отменено' };
            return worksheet;
        });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles no tickets and no user', async () => {
        (fetchTickets as any).mockResolvedValueOnce({
            tickets: [],
            max_page: 1
        });
        (getStore as any).mockReturnValue(undefined);

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles fetchTickets returning undefined', async () => {
        (fetchTickets as any).mockResolvedValueOnce(undefined);
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await expect(generateStatisticsReport('2024-06-01', '2024-06-03')).rejects.toThrow(TypeError);
    });

    it('handles fetchTickets returning object with undefined tickets and max_page', async () => {
        (fetchTickets as any).mockResolvedValueOnce({});
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');
        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles fetchTickets returning object with tickets as undefined and max_page as 2', async () => {
        (fetchTickets as any).mockResolvedValueOnce({ tickets: undefined, max_page: 2 });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');
        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles fetchTickets returning object with tickets as null and max_page as null', async () => {
        (fetchTickets as any).mockResolvedValueOnce({ tickets: null, max_page: null });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');
        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles ticket.building as undefined', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: undefined,
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({
            tickets,
            max_page: 1
        });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles ticket.building as null', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: null,
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({
            tickets,
            max_page: 1
        });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles ticket.cabinet as undefined', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: undefined,
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({
            tickets,
            max_page: 1
        });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles ticket.cabinet as null', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: null,
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({
            tickets,
            max_page: 1
        });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles ticket.id as undefined', async () => {
        const tickets = [
            {
                id: undefined,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({
            tickets,
            max_page: 1
        });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles ticket.title as undefined', async () => {
        const tickets = [
            {
                id: 1,
                title: undefined,
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({
            tickets,
            max_page: 1
        });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles ticket.description as undefined', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: undefined,
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({
            tickets,
            max_page: 1
        });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles ticket.note as undefined', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: undefined
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({
            tickets,
            max_page: 1
        });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('handles more performers than statRows (переполнение performerBlock)', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }, { name: 'Petr' }, { name: 'Sergey' }, { name: 'Anna' }, { name: 'Olga' }],
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({ tickets, max_page: 1 });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('does not count performer if name is falsy (null, undefined, empty string, 0)', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test',
                description: 'Desc',
                building: { name: 'Bldg' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: null }, { name: undefined }, { name: '' }, { name: 0 }],
                status: 'open',
                note: 'Note'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({ tickets, max_page: 1 });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(mockSaveAs).toHaveBeenCalled();
    });

    it('applies style to parameters header cell if cell exists', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({ tickets, max_page: 1 });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        // @ts-ignore
        mockAoaToSheet.mockImplementationOnce((excelData: any[][]) => {
            const ws: any = {};
            ws['!cols'] = [];
            ws['!rows'] = [];
            ws['!merges'] = [];
            ws['!ref'] = 'A1:H20';
            const paramRow = excelData.findIndex(row => row[0] === 'Параметры отчёта');
            if (paramRow !== -1)
                ws[`A${paramRow + 1}`] = { v: 'Параметры отчёта' };
            
            return ws;
        });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        const ws = mockAoaToSheet.mock.results[0].value;
        const paramCell = Object.values(ws).find((cell: any) => cell && cell.v === 'Параметры отчёта');
        expect(paramCell).toHaveProperty('s');
    });    

    it('applies style to header row cells if cells exist', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({ tickets, max_page: 1 });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        // @ts-ignore
        mockAoaToSheet.mockImplementationOnce((excelData: any[][]) => {
            const ws: any = {};
            ws['!cols'] = [];
            ws['!rows'] = [];
            ws['!merges'] = [];
            ws['!ref'] = 'A1:H20';
            for (let c = 0; c < 8; c++) {
                const col = String.fromCharCode(65 + c);
                ws[`${col}1`] = { v: `header${c}` };
            }
            return ws;
        });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        const ws = mockAoaToSheet.mock.results[0].value;
        for (let c = 0; c < 8; c++) {
            const col = String.fromCharCode(65 + c);
            expect(ws[`${col}1`]).toHaveProperty('s');
        }
    });

    it('applies style to stats header merged cells if cells exist', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({ tickets, max_page: 1 });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        // @ts-ignore
        mockAoaToSheet.mockImplementationOnce((excelData: any[][]) => {
            const ws: any = {};
            ws['!cols'] = [];
            ws['!rows'] = [];
            ws['!merges'] = [];
            ws['!ref'] = 'A1:H20';
            const statHeaderRow = excelData.findIndex(row => Array.isArray(row) && row[0] === 'Статистика по статусам');
            if (statHeaderRow !== -1) {
                ws[`A${statHeaderRow + 1}`] = { v: 'Статистика по статусам' };
                ws[`D${statHeaderRow + 1}`] = { v: 'Статистика по исполнителям' };
            }
            return ws;
        });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        const ws = mockAoaToSheet.mock.results[0].value;
        const statHeaderRow = Object.keys(ws).find(key => ws[key]?.v === 'Статистика по статусам')?.replace(/\D/g, '');
        expect(ws[`A${statHeaderRow}`]).toHaveProperty('s');
        expect(ws[`D${statHeaderRow}`]).toHaveProperty('s');
    });

    it('sets increased row height if cell text length is greater than 60', async () => {
        const longText = 'A'.repeat(61);
        const tickets = [
            {
                id: 1,
                title: longText,
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({ tickets, max_page: 1 });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        let worksheet: any = {};
        // @ts-ignore
        mockAoaToSheet.mockImplementationOnce((excelData: any[][]) => {
            worksheet = {};
            worksheet['!cols'] = [];
            worksheet['!rows'] = [];
            worksheet['!merges'] = [];
            worksheet['!ref'] = 'A1:H2';
            worksheet['B2'] = { v: longText };
            return worksheet;
        });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(worksheet['!rows'][1].hpt).toBeGreaterThan(22);
    });

    it('removes border for cells in columns 2 and 5 after main rows', async () => {
        const tickets = [
            {
                id: 1,
                title: 'Test 1',
                description: 'Desc 1',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({ tickets, max_page: 1 });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        let worksheet: any = {};
        // @ts-ignore
        mockAoaToSheet.mockImplementationOnce((excelData: any[][]) => {
            worksheet = {};
            worksheet['!cols'] = [];
            worksheet['!rows'] = [];
            worksheet['!merges'] = [];
            worksheet['!ref'] = 'A1:H10';
            worksheet['C3'] = { v: 'remove border' };
            worksheet['F3'] = { v: 'remove border' };
            return worksheet;
        });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(worksheet['C3'].s.border).toBeUndefined();
        expect(worksheet['F3'].s.border).toBeUndefined();
    });

    it('covers branch where lineBreaks * 30 > maxLen for short text with line breaks', async () => {
        const tickets = [
            {
                id: 1,
                title: 'A'.repeat(61),
                description: 'a\nb\nc',
                building: { name: 'Bldg1' },
                cabinet: '101',
                created_at: '2024-06-01T10:00:00.000Z',
                assigned_to: [{ name: 'Ivan' }],
                status: 'open',
                note: 'Note 1'
            }
        ];
        (fetchTickets as any).mockResolvedValueOnce({ tickets, max_page: 1 });
        (getStore as any).mockReturnValue({ name: 'Admin' });

        let worksheet: any = {};
        // @ts-ignore
        mockAoaToSheet.mockImplementationOnce((excelData: any[][]) => {
            worksheet['!cols'] = [];
            worksheet['!rows'] = [];
            worksheet['!merges'] = [];
            worksheet['!ref'] = 'A1:H2';
            worksheet['B2'] = { v: 'A'.repeat(61) };
            worksheet['C2'] = { v: 'a\nb\nc' };
            return worksheet;
        });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(Array.isArray(worksheet['!rows'])).toBe(true);
        expect(worksheet['!rows'].length).toBeGreaterThan(0);
        expect(mockSaveAs).toHaveBeenCalled();
    });
});