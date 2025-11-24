import { api } from '$lib/utils/api';
import { getById } from '$lib/utils/tickets/api/get';
import { notification, NotificationType } from '$lib/utils/notifications/notification';
import { TICKETS_API_ENDPOINTS } from './endpoints';
import type { Ticket } from '$lib/utils/tickets/types';

/**
 * Назначает тикет на исполнителя.
 * @param ticketId ID тикета, который нужно назначить.
 */
export async function assign(ticketId: string): Promise<void> {
    const response = await api.patch(`${TICKETS_API_ENDPOINTS.read}${ticketId}/assign`);

    if (!response.success)
        throw new Error(response.error || 'Ошибка назначения заявки');
}

/**
 * Снимает назначение тикета с исполнителя.
 * @param ticketId ID тикета, с которого нужно снять назначение.
 */
export async function unassign(ticketId: string): Promise<void> {
    const response = await api.patch(`${TICKETS_API_ENDPOINTS.read}${ticketId}/unassign`);

    if (!response.success)
        throw new Error(response.error || 'Ошибка снятия назначения заявки');
}

/**
 * Назначить конкретного пользователя на тикет.
 * Делает POST-запрос, обрабатывает ошибки и в случае успеха подтягивает обновлённые данные тикета.
 * @param ticketId ID тикета.
 * @param userId ID пользователя.
 * @return Объект с результатом операции и обновлёнными данными тикета в случае успеха.
 */
export async function assignUserToTicket(ticketId: string, userId: string): Promise<{ success: true; ticket: Ticket } | { success: false; error: string }> {
    try {
        const response = await api.post(`${TICKETS_API_ENDPOINTS.update}/${ticketId}/assign/${userId}`);

        if (!response || !response.success) {
            const err = response?.error || 'Ошибка при назначении сотрудника';
            notification(err, NotificationType.Error);
            return { success: false, error: err };
        }

        const ticket = await getById(ticketId);
        notification('Сотрудник назначен', NotificationType.Success);
        return { success: true, ticket };
    } catch (e) {
        const msg = (e instanceof Error ? e.message : 'Ошибка при назначении сотрудника');
        notification(msg, NotificationType.Error);
        return { success: false, error: String(msg) };
    }
}

/**
 * Снять с тикета конкретного исполнителя.
 * Делает POST-запрос, обрабатывает ошибки и в случае успеха подтягивает обновлённые данные тикета.
 * @param ticketId ID тикета.
 * @param executorId ID исполнителя.
 * @return Объект с результатом операции и обновлёнными данными тикета в случае успеха.
 */
export async function unassignUserFromTicket(ticketId: string, executorId: string): Promise<{ success: true; ticket: Ticket } | { success: false; error: string }> {
    try {
        const response = await api.post(`${TICKETS_API_ENDPOINTS.update}/${ticketId}/unassign/${executorId}`);

        if (!response || !response.success) {
            const err = response?.error || 'Ошибка при снятии исполнителя';
            notification(err, NotificationType.Error);
            return { success: false, error: err };
        }

        const ticket = await getById(ticketId);
        notification('Исполнитель снят с заявки', NotificationType.Success);
        return { success: true, ticket };
    } catch (e) {
        const msg = (e instanceof Error ? e.message : 'Ошибка при снятии исполнителя');
        notification(msg, NotificationType.Error);
        return { success: false, error: String(msg) };
    }
}