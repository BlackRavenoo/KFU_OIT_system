import { getAuthTokens } from '$lib/utils/auth/tokens/tokens';
import { TICKETS_API_ENDPOINTS } from './endpoints';

/**
 * Обновление тикета по ID.
 * Отправляет PATCH-запрос на сервер с обновлёнными данными тикета.
 * @param ticketId Идентификатор тикета, который нужно обновить.
 * @param data Данные для обновления тикета.
 */
export async function update(
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
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthTokens()?.accessToken}`
        },
        body: JSON.stringify(data)
    });

    if (!response.ok || response.status !== 200) throw new Error('Ошибка обновления заявки');
}