import { api } from '$lib/utils/api';

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

export interface DashboardMetricsQuery {
	buildingId?: number;
	departmentId?: number;
}

interface DashboardTotals {
	total: number;
	closed: number;
	slaBreaches: number;
}

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

export function calcSlaPercent(closed: number, slaBreaches: number): number {
	if (!closed) return 0;

	const rawValue = ((closed - slaBreaches) / closed) * 100;
	return Math.max(0, Math.min(100, rawValue));
}

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

function toInt(value: unknown): number {
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) return 0;
	return Math.round(numeric);
}
