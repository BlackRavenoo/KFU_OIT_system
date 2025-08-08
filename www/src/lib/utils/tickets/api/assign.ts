import { api } from '$lib/utils/api';
import { TICKETS_API_ENDPOINTS } from './endpoints';

/**
 * Назначает тикет на исполнителя.
 * @param ticketId ID тикета, который нужно назначить.
 */
export async function assign(ticketId: string): Promise<void> {
    const response = await api.patch(`${TICKETS_API_ENDPOINTS.read}${ticketId}/assign`);

    if (!response.success) {
        throw new Error(response.error || 'Ошибка назначения заявки');
    }
}

/**
 * Снимает назначение тикета с исполнителя.
 * @param ticketId ID тикета, с которого нужно снять назначение.
 */
export async function unassign(ticketId: string): Promise<void> {
    const response = await api.patch(`${TICKETS_API_ENDPOINTS.read}${ticketId}/unassign`);

    if (!response.success) {
        throw new Error(response.error || 'Ошибка снятия назначения заявки');
    }
}