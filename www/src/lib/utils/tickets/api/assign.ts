import { getAuthTokens } from '$lib/utils/auth/tokens/tokens';
import { TICKETS_API_ENDPOINTS } from './endpoints';

/**
 * Назначает тикет на исполнителя.
 * @param ticketId ID тикета, который нужно назначить.
 */
export async function assign(
    ticketId: string,
): Promise<void> {
    const response = await fetch(`${TICKETS_API_ENDPOINTS.read}${ticketId}/assign`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthTokens()?.accessToken}`
        }
    });

    if (!response.ok) throw new Error('Ошибка получения заявки');
}

/**
 * Снимает назначение тикета с исполнителя.
 * @param ticketId ID тикета, с которого нужно снять назначение.
 */
export async function unassign(
    ticketId: string,
): Promise<void> {
    const response = await fetch(`${TICKETS_API_ENDPOINTS.read}${ticketId}/unassign`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthTokens()?.accessToken}`
        }
    });

    if (!response.ok) throw new Error('Ошибка получения заявки');
}