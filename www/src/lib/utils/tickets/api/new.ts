import { TICKETS_API_ENDPOINTS } from '$lib/utils/tickets/api/endpoints';

/**
 * Обработчик отправки формы заявки.
 * @param {string} Title - Заголовок заявки.
 * @param {string} Description - Описание заявки.
 * @param {string} Name - Имя автора заявки.
 * @param {string} Contact - Контактные данные автора заявки.
 * @param {string} DateVal - Дата, запланированная для заявки.
 * @param {File[] | null} File - Файлы, прикрепленные к заявке (необязательный параметр).
 */
export async function fetchTicket(
    Title: string,
    Description: string,
    Name: string,
    Contact: string,
    Building: string,
    Cabinet: string,
    DateVal: string,
    File?: File[] | null
) {
    if (!Title || !Description || !Name || !Contact || !Building || !Cabinet)
        throw new Error('Все поля обязательны для заполнения');

    const fields = {
        title: Title.trim(),
        description: Description.trim(),
        author: Name.trim(),
        author_contacts: Contact.trim(),
        // building: Building,
        // cabinet: string,
        planned_at: DateVal && DateVal.trim() ? normalizeDate(DateVal) : null
    };

    const formData = new FormData();
    formData.append('fields', new Blob([JSON.stringify(fields)], { type: 'application/json' }));

    if (File && File.length > 0)
        for (const file of File)
            formData.append('attachments', file);

    const response = await fetch(TICKETS_API_ENDPOINTS.create, {
        method: 'POST',
        body: formData,
        credentials: 'include'
    });

    if (!response.ok)
        throw new Error('Network response was not ok');
}

/**
 * Нормализует дату в формате ISO 8601.
 * @param {string} date - Дата в строковом формате.
 */
function normalizeDate(date: string): string | null {
    if (!date || !date.trim()) return null;
    if (/T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?$/.test(date)) return date;
    return date + ':00Z';
}