import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const apiMock = {
    post: vi.fn()
};

vi.mock('$lib/utils/api', () => ({ api: apiMock }));

describe('Generate statistics report', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Requests report from server and downloads xlsx file', async () => {
        const { generateStatisticsReport } = await import('$lib/utils/admin/statics/report');

        const clickMock = vi.fn();
        const originalCreateElement = document.createElement.bind(document);

        vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
            if (tagName === 'a') {
                return {
                    href: '',
                    download: '',
                    click: clickMock
                } as any;
            }

            return originalCreateElement(tagName);
        });

        vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => node);
        vi.spyOn(document.body, 'removeChild').mockImplementation((node: Node) => node);

        const createObjectURLMock = vi.fn(() => 'blob:test-url');
        const revokeObjectURLMock = vi.fn();

        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            writable: true,
            value: createObjectURLMock
        });

        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            writable: true,
            value: revokeObjectURLMock
        });

        apiMock.post.mockResolvedValue({
            success: true,
            status: 200,
            data: new Blob(['xlsx'])
        });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(apiMock.post).toHaveBeenCalledWith(
            '/api/v1/reports/tickets/statistics',
            {
                from_date: new Date('2024-06-01T00:00:00').toISOString(),
                to_date: new Date('2024-06-03T23:59:59.999').toISOString()
            },
            'blob'
        );
        expect(clickMock).toHaveBeenCalledTimes(1);
        expect(createObjectURLMock).toHaveBeenCalledTimes(1);
        expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test-url');
    });

    it('Throws validation error when fromDate is greater than toDate', async () => {
        const { generateStatisticsReport } = await import('$lib/utils/admin/statics/report');

        await expect(generateStatisticsReport('2024-06-05', '2024-06-01')).rejects.toThrow(
            'Дата начала не может быть больше даты окончания'
        );
        expect(apiMock.post).not.toHaveBeenCalled();
    });

    it('Throws server error when report endpoint fails', async () => {
        const { generateStatisticsReport } = await import('$lib/utils/admin/statics/report');

        apiMock.post.mockResolvedValue({
            success: false,
            status: 500,
            error: 'Ошибка сервера'
        });

        await expect(generateStatisticsReport('2024-06-01', '2024-06-03')).rejects.toThrow('Ошибка сервера');
    });

    it('Throws exact validation error for invalid date format', async () => {
        const { generateStatisticsReport } = await import('$lib/utils/admin/statics/report');
        await expect(generateStatisticsReport('invalid-date', '2024-06-03')).rejects.toThrow('Некорректный формат даты');
        expect(apiMock.post).not.toHaveBeenCalled();
    });

	it('Throws fallback error when server message is missing', async () => {
        const { generateStatisticsReport } = await import('$lib/utils/admin/statics/report');
        apiMock.post.mockResolvedValue({
            success: false,
            status: 500
        });
        await expect(generateStatisticsReport('2024-06-01', '2024-06-03')).rejects.toThrow('Не удалось сформировать отчёт');
    });

    it('Creates blob from non-blob server payload', async () => {
        const { generateStatisticsReport } = await import('$lib/utils/admin/statics/report');
        const clickMock = vi.fn();
        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
            if (tagName === 'a') {
                return {
                    href: '',
                    download: '',
                    click: clickMock
                } as any;
            }
            return originalCreateElement(tagName);
        });
        vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => node);
        vi.spyOn(document.body, 'removeChild').mockImplementation((node: Node) => node);
        const createObjectURLMock = vi.fn(() => 'blob:test-url');
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            writable: true,
            value: createObjectURLMock
        });
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            writable: true,
            value: vi.fn()
        });
        apiMock.post.mockResolvedValue({
            success: true,
            status: 200,
            data: 'xlsx-binary'
        });

        await generateStatisticsReport('2024-06-01', '2024-06-03');

        expect(createObjectURLMock).toHaveBeenCalledTimes(1);
        // @ts-ignore
        const blobArg = createObjectURLMock.mock.calls[0][0] as Blob;
        expect(blobArg).toBeInstanceOf(Blob);
        expect(blobArg.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        expect(blobArg.size).toBe('xlsx-binary'.length);
    });
});