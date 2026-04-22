import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = {
	get: vi.fn()
};

vi.mock('$lib/utils/api', () => ({ api: apiMock }));

beforeEach(() => {
	vi.clearAllMocks();
});

describe('Dashboard metrics utils', () => {
	it('Passes both filters when buildingId and departmentId are positive', async () => {
		apiMock.get.mockResolvedValue({ success: true, data: [] });

		const { getTicketsMetrics } = await import('$lib/utils/admin/statics/dashboard');
		await getTicketsMetrics({ buildingId: 3, departmentId: 8 });

		expect(apiMock.get).toHaveBeenCalledWith('/api/v1/tickets/metrics', {
			building_id: 3,
			department_id: 8
		});
	});

	it('Skips filters when ids are missing, zero or negative', async () => {
		apiMock.get.mockResolvedValue({ success: true, data: [] });

		const { getTicketsMetrics } = await import('$lib/utils/admin/statics/dashboard');
		await getTicketsMetrics({ buildingId: 0, departmentId: -10 });

		expect(apiMock.get).toHaveBeenCalledWith('/api/v1/tickets/metrics', {});
	});

	it('Throws server message when API responds with success=false', async () => {
		apiMock.get.mockResolvedValue({
			success: false,
			error: 'backend failure'
		});

		const { getTicketsMetrics } = await import('$lib/utils/admin/statics/dashboard');
		await expect(getTicketsMetrics({ buildingId: 1 })).rejects.toThrow('backend failure');
	});

	it('Throws fallback message when API responds with success=false and no error text', async () => {
		apiMock.get.mockResolvedValue({ success: false });

		const { getTicketsMetrics } = await import('$lib/utils/admin/statics/dashboard');
		await expect(getTicketsMetrics({ departmentId: 1 })).rejects.toThrow('Не удалось загрузить метрики');
	});

	it('Throws when success=true but data is not an array', async () => {
		apiMock.get.mockResolvedValue({ success: true, data: { month: 1 } });

		const { getTicketsMetrics } = await import('$lib/utils/admin/statics/dashboard');
		await expect(getTicketsMetrics()).rejects.toThrow('Не удалось загрузить метрики');
	});

	it('Normalizes values, handles non-finite numbers and sorts by month', async () => {
		apiMock.get.mockResolvedValue({
			success: true,
			data: [
				{
					month: '12',
					total: '10.6',
					closed: 6.2,
					avg_frt: '59.6',
					p50_frt: '9.5',
					p90_frt: Infinity,
					p95_frt: 'NaN',
					avg_mttr: null,
					p50_mttr: undefined,
					p90_mttr: '3600.4',
					p95_mttr: '3600.5',
					sla_breaches: '2.8'
				},
				{
					month: '2.4',
					total: -2.2,
					closed: '-1.5',
					avg_frt: 0,
					p50_frt: '0',
					p90_frt: 1,
					p95_frt: 2,
					avg_mttr: 3,
					p50_mttr: 4,
					p90_mttr: 5,
					p95_mttr: 6,
					sla_breaches: 7
				}
			]
		});

		const { getTicketsMetrics } = await import('$lib/utils/admin/statics/dashboard');
		const result = await getTicketsMetrics();

		expect(result).toEqual([
			{
				month: 2,
				total: -2,
				closed: -1,
				avg_frt: 0,
				p50_frt: 0,
				p90_frt: 1,
				p95_frt: 2,
				avg_mttr: 3,
				p50_mttr: 4,
				p90_mttr: 5,
				p95_mttr: 6,
				sla_breaches: 7
			},
			{
				month: 12,
				total: 11,
				closed: 6,
				avg_frt: 60,
				p50_frt: 10,
				p90_frt: 0,
				p95_frt: 0,
				avg_mttr: 0,
				p50_mttr: 0,
				p90_mttr: 3600,
				p95_mttr: 3601,
				sla_breaches: 3
			}
		]);
	});

	it('Calculates totals for empty metrics array', async () => {
		const { calcDashboardTotals } = await import('$lib/utils/admin/statics/dashboard');
		expect(calcDashboardTotals([])).toEqual({ total: 0, closed: 0, slaBreaches: 0 });
	});

	it('Calculates totals for non-empty metrics array', async () => {
		const { calcDashboardTotals } = await import('$lib/utils/admin/statics/dashboard');
		const totals = calcDashboardTotals([
			{
				month: 1,
				total: 10,
				closed: 7,
				avg_frt: 0,
				p50_frt: 0,
				p90_frt: 0,
				p95_frt: 0,
				avg_mttr: 0,
				p50_mttr: 0,
				p90_mttr: 0,
				p95_mttr: 0,
				sla_breaches: 2
			},
			{
				month: 2,
				total: 5,
				closed: 5,
				avg_frt: 0,
				p50_frt: 0,
				p90_frt: 0,
				p95_frt: 0,
				avg_mttr: 0,
				p50_mttr: 0,
				p90_mttr: 0,
				p95_mttr: 0,
				sla_breaches: 1
			}
		]);

		expect(totals).toEqual({ total: 15, closed: 12, slaBreaches: 3 });
	});

	it('Returns 0 SLA percent when closed is 0', async () => {
		const { calcSlaPercent } = await import('$lib/utils/admin/statics/dashboard');
		expect(calcSlaPercent(0, 999)).toBe(0);
	});

	it('Returns regular SLA percent when value is in range', async () => {
		const { calcSlaPercent } = await import('$lib/utils/admin/statics/dashboard');
		expect(calcSlaPercent(10, 2)).toBe(80);
	});

	it('Clamps SLA percent to 0..100 bounds', async () => {
		const { calcSlaPercent } = await import('$lib/utils/admin/statics/dashboard');
		expect(calcSlaPercent(10, 20)).toBe(0);
		expect(calcSlaPercent(10, -5)).toBe(100);
	});
});
