import { api } from '$lib/utils/api';

export interface UserStats {
    assignedToMe: number;
    completedTickets: number;
    cancelledTickets: number;
}

/**
 * Загрузка статистики пользователя
 * @param userId ID пользователя
 * @param stats Текущие статистические данные
 * @returns Обновленные статистические данные
 */
export async function loadUserStats(
    userId: string, 
    stats: { assignedToMe: number, completedTickets: number, cancelledTickets: number }
): Promise<{ assignedToMe: number, completedTickets: number, cancelledTickets: number }> {
    try {
        if (!userId) return stats;
        
        const response = await api.get(`/api/v1/user/stats?user_id=${userId}`);

        if (response.success) {
            return {
                assignedToMe: (response.data as any).active_tickets_count || 0,
                completedTickets: (response.data as any).closed_tickets_count || 0,
                cancelledTickets: (response.data as any).cancelled_tickets_count || 0
            };
        }
        
        return stats;
    } catch (error) {
        return stats;
    }
}