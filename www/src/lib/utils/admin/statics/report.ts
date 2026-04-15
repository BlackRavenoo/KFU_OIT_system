import { api } from '$lib/utils/api';

/**
 * Формирование и скачивание отчёта по заявкам в Excel
 * (файл формируется на сервере)
 * @param fromDate - дата начала периода (включительно) в формате 'YYYY-MM-DD'
 * @param toDate - дата окончания периода (включительно) в формате 'YYYY-MM-DD'
 */
export async function generateStatisticsReport(
    fromDate: string,
    toDate: string
): Promise<void> {
    const fromDateObj = new Date(`${ fromDate }T00:00:00`);
    const toDateObj = new Date(`${ toDate }T23:59:59.999`);

    if (Number.isNaN(fromDateObj.getTime()) || Number.isNaN(toDateObj.getTime()))
        throw new Error('Некорректный формат даты');

    if (fromDateObj.getTime() > toDateObj.getTime())
        throw new Error('Дата начала не может быть больше даты окончания');

    const response = await api.post<Blob>(
        '/api/v1/reports/tickets/statistics',
        {
            from_date: fromDateObj.toISOString(),
            to_date: toDateObj.toISOString()
        },
        'blob'
    );

    if (!response.success || !response.data)
        throw new Error(response.error || 'Не удалось сформировать отчёт');

    const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `statistic_${fromDate}_${toDate}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
}