import { api } from '$lib/utils/api';

export interface UserStats {
    assignedToMe: number;
    completedTickets: number;
    cancelledTickets: number;
}

const CACHE_KEY_PUBLIC_STATS = 'public_stats_cache';
const CACHE_TTL_PUBLIC_STATS = 15 * 60 * 1000;

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

/**
 * Получение публичной статистики по заявкам
 * @returns Статистические данные 
 * - todayCount: Количество заявок за сегодня
 * - totalCount: Общее количество заявок
 * - percentOfSolutions: Процент решенных заявок
 */
export async function getPublicStats(): Promise<{ todayCount: number, totalCount: number, percentOfSolutions: number }> {
    try {
        const cached = localStorage.getItem(CACHE_KEY_PUBLIC_STATS);
        if (cached) {
            try {
                const parsedCache = JSON.parse(cached);
                const isExpired = Date.now() - parsedCache.timestamp > CACHE_TTL_PUBLIC_STATS;
                
                if (!isExpired && parsedCache.data) {
                    return {
                        todayCount: parsedCache.data.todayCount || 0,
                        totalCount: parsedCache.data.totalCount || 0,
                        percentOfSolutions: parsedCache.data.percentOfSolutions || 0
                    };
                }
            } catch {
                localStorage.removeItem(CACHE_KEY_PUBLIC_STATS);
            }
        }

        const response = await api.get('/api/v1/tickets/stats');
        const result = {
            todayCount: 0,
            totalCount: 0,
            percentOfSolutions: 0
        };

        if (response.success) {
            result.todayCount = (response.data as any).daily_tickets || 0;
            result.totalCount = (response.data as any).tickets_count || 0;
            result.percentOfSolutions = (response.data as any).percent_of_closed || 0;
        }

        try {
            localStorage.setItem(CACHE_KEY_PUBLIC_STATS, JSON.stringify({
                timestamp: Date.now(),
                data: result
            }));
        } catch {
            console.warn('Не удалось сохранить статистику в кеш');
        }

        return result;
    } catch (error) {
        return {
            todayCount: 0,
            totalCount: 0,
            percentOfSolutions: 0
        };
    }
}