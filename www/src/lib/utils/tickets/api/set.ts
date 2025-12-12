import { api } from '$lib/utils/api';
import { TICKETS_API_ENDPOINTS } from '$lib/utils/tickets/api/endpoints';
import { normalizeDate } from '$lib/utils/tickets/support';

/**
 * Обработчик отправки формы заявки.
 * @param {string} Title - Заголовок заявки.
 * @param {string} Description - Описание заявки.
 * @param {string} Name - Имя автора заявки.
 * @param {string} Contact - Контактные данные автора заявки.
 * @param {string} DateVal - Дата, запланированная для заявки.
 * @param {File[] | null} File - Файлы, прикрепленные к заявке (необязательный параметр).
 */
export async function createTicket(
    Title: string,
    Description: string,
    Name: string,
    Contact: string,
    Building: number,
    Cabinet: string,
    DateVal: string,
    Department: number,
    File?: File[] | null
) {
    if (!Title || !Description || !Name || !Contact || !Building || !Cabinet || Department === -1)
        throw new Error('Все поля обязательны для заполнения');

    const fields = {
        title: Title.trim(),
        description: Description.trim(),
        author: Name.trim(),
        author_contacts: Contact.trim(),
        building_id: Building,
        cabinet: Cabinet,
        planned_at: DateVal && DateVal.trim() ? normalizeDate(DateVal) : null,
        department_id: Department
    };

    const formData = new FormData();
    formData.append('fields', new Blob([JSON.stringify(fields)], { type: 'application/json' }));

    if (File && File.length > 0)
        for (const file of File)
            formData.append('attachments', file);

    const response = await api.post(TICKETS_API_ENDPOINTS.create, formData);

    if (!response.success)
        throw new Error(response.error || 'Ошибка создания заявки');
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
        building_id?: number | { id: number } | null;
        cabinet?: string | null;
        department_id?: number | null;
        attachments_to_delete?: string[];
        attachments_to_add?: File[] | null;
    }
): Promise<void> {
    if (Object.keys(data).length === 1) return;

    if (typeof (data as any).building === 'object' && (data as any).building !== null && 'id' in (data as any).building)
        data.building_id = ((data as any).building as { id: number }).id;
    if (data.planned_at) data.planned_at = normalizeDate(data.planned_at);
    const formData = new FormData();

    const filteredData = Object.fromEntries(
        Object.entries(data).filter(([key, value]) => {
            if (key === 'id' || key === 'attachments_to_add') return false;
            if (value === "" || value === null || value === undefined) return false;
            return true;
        })
    );

    formData.append('fields', new Blob([JSON.stringify(filteredData)], { type: 'application/json' }));

    if (data.attachments_to_add && data.attachments_to_add.length > 0)
        for (const file of data.attachments_to_add)
            formData.append('attachments_to_add', file);

    const response = await api.put(`${TICKETS_API_ENDPOINTS.read}${ticketId}`, formData);

    if (!response.success)
        throw new Error(response.error || 'Ошибка обновления заявки');
}

/**
 * Функция для удаления тикета по ID.
 * Отправляет DELETE-запрос на сервер для удаления тикета.
 * @param ticketId Идентификатор тикета, который нужно удалить.
 */
export async function deleteTicket(ticketId: string): Promise<void> {
    const response = await api.delete(`${TICKETS_API_ENDPOINTS.delete}${ticketId}`);

    if (!response.success)
        throw new Error(response.error || 'Ошибка при удалении заявки');
}