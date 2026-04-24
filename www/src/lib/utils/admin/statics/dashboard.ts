import { api } from '$lib/utils/api';

/**
 * Интерфейс для метрик по тикетам, используемых в админской панели.
 * month - номер месяца (1-12)
 * total - общее количество тикетов, созданных в этом месяце
 * closed - количество тикетов, закрытых в этом месяце
 * avg_frt - среднее время первого ответа (в минутах)
 * p50_frt - 50-й перцентиль времени первого ответа (в минутах)
 * p90_frt - 90-й перцентиль времени первого ответа (в минутах)
 * p95_frt - 95-й перцентиль времени первого ответа (в минутах)
 * avg_mttr - среднее время решения (MTTR) в минутах
 * p50_mttr - 50-й перцентиль MTTR в минутах
 * p90_mttr - 90-й перцентиль MTTR в минутах
 * p95_mttr - 95-й перцентиль MTTR в минутах
 * sla_breaches - количество нарушений SLA в этом месяце
 */
export interface TicketsMetrics {
	month: number;
	total: number;
	closed: number;
	avg_frt: number;
	p50_frt: number;
	p90_frt: number;
	p95_frt: number;
	avg_mttr: number;
	p50_mttr: number;
	p90_mttr: number;
	p95_mttr: number;
	sla_breaches: number;
}

/**
 * Параметры для запроса метрик на дашборде. Позволяют фильтровать данные по зданию и отделу.
 * buildingId - ID здания для фильтрации (необязательно)
 * departmentId - ID отдела для фильтрации (необязательно)
 */
export interface DashboardMetricsQuery {
	buildingId?: number;
	departmentId?: number;
}

/**
 * Итоговые показатели для отображения на дашборде. Суммируются по всем месяцам.
 * total - общее количество тикетов
 * closed - количество закрытых тикетов
 * slaBreaches - количество нарушений SLA
 */
interface DashboardTotals {
	total: number;
	closed: number;
	slaBreaches: number;
}

/**
 * Функция для получения метрик по тикетам с сервера
 * Принимает необязательные параметры для фильтрации по зданию и отделу.
 * @param query - параметры для фильтрации метрик
 * @returns массив метрик по тикетам
 */
export async function getTicketsMetrics(
	query: DashboardMetricsQuery = {}
): Promise<TicketsMetrics[]> {
	const params: Record<string, number> = {};

	if (query.buildingId && query.buildingId > 0)
		params.building_id = query.buildingId;
	if (query.departmentId && query.departmentId > 0)
		params.department_id = query.departmentId;

	const response = await api.get<TicketsMetrics[]>('/api/v1/tickets/metrics', params);

	if (!response.success || !Array.isArray(response.data)) {
		throw new Error(response.error || 'Не удалось загрузить метрики');
	}

	return response.data
		.map(normalizeMetrics)
		.sort((a, b) => a.month - b.month);
}

/**
 * Функция для расчета итоговых показателей для дашборда 
 * На основе массива метрик по тикетам.
 * @param metrics - массив метрик по тикетам
 * @returns объект с итоговыми показателями
 */
export function calcDashboardTotals(metrics: TicketsMetrics[]): DashboardTotals {
	return metrics.reduce<DashboardTotals>(
		(acc, item) => ({
			total: acc.total + item.total,
			closed: acc.closed + item.closed,
			slaBreaches: acc.slaBreaches + item.sla_breaches
		}),
		{
			total: 0,
			closed: 0,
			slaBreaches: 0
		}
	);
}

/**
 * Функция для расчета процента соблюдения SLA 
 * На основе количества закрытых тикетов и нарушений SLA.
 * @param closed - количество закрытых тикетов
 * @param slaBreaches - количество нарушений SLA
 * @returns процент соблюдения SLA
 */
export function calcSlaPercent(closed: number, slaBreaches: number): number {
	if (!closed) return 0;

	const rawValue = ((closed - slaBreaches) / closed) * 100;
	return Math.max(0, Math.min(100, rawValue));
}

/**
 * Функция для нормализации данных метрик по тикетам, полученных с сервера.
 * Преобразует все числовые значения в целые числа, чтобы избежать проблем с типами данных.
 * @param raw - необработанные данные метрик
 * @returns нормализованные данные метрик
 */
function normalizeMetrics(raw: TicketsMetrics): TicketsMetrics {
	return {
		month: toInt(raw.month),
		total: toInt(raw.total),
		closed: toInt(raw.closed),
		avg_frt: toInt(raw.avg_frt),
		p50_frt: toInt(raw.p50_frt),
		p90_frt: toInt(raw.p90_frt),
		p95_frt: toInt(raw.p95_frt),
		avg_mttr: toInt(raw.avg_mttr),
		p50_mttr: toInt(raw.p50_mttr),
		p90_mttr: toInt(raw.p90_mttr),
		p95_mttr: toInt(raw.p95_mttr),
		sla_breaches: toInt(raw.sla_breaches)
	};
}

/**
 * Функция для безопасного преобразования значения в целое число. 
 * Если значение не является числом или не является конечным, возвращает 0.
 * @param value - значение для преобразования
 * @returns целое число или 0, если преобразование невозможно
 */
function toInt(value: unknown): number {
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) return 0;
	return Math.round(numeric);
}
