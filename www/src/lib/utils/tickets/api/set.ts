import { TICKETS_API_ENDPOINTS } from '$lib/utils/tickets/api/endpoints';
import { normalizeDate } from '$lib/utils/tickets/support';
import { getAuthTokens } from '$lib/utils/auth/tokens/tokens';

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
    Building: number,
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
        building_id: Building,
        cabinet: Cabinet,
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
 * Обновление тикета по ID.
 * Отправляет PATCH-запрос на сервер с обновлёнными данными тикета.
 * @param ticketId Идентификатор тикета, который нужно обновить.
 * @param data Данные для обновления тикета.
 */
export async function updateTicket(
    ticketId: string,
    data: {
        title?: string;
        description?: string;
        status?: string;
        priority?: string;
        planned_at?: string | null;
        assigned_to?: string | null;
        building_id?: number | null;
        cabinet?: string | null;
    }
): Promise<void> {
    const response = await fetch(`${TICKETS_API_ENDPOINTS.read}${ticketId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthTokens()?.accessToken}`
        },
        body: JSON.stringify(data)
    });

    if (!response.ok || response.status !== 200) throw new Error('Ошибка обновления заявки');
}

/**
 * Функция для удаления тикета по ID.
 * Отправляет DELETE-запрос на сервер для удаления тикета.
 * @param ticketId Идентификатор тикета, который нужно удалить.
 */
export async function deleteTicket(ticketId: string): Promise<void> {
    const response = await fetch(`${TICKETS_API_ENDPOINTS.delete}${ticketId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${getAuthTokens()?.accessToken}`
        }
    });
    if (!response.ok) throw new Error('Ошибка при удалении');
}