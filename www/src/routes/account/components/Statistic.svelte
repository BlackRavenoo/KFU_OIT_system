<script lang="ts">
    import { onMount } from 'svelte';

    import {
        calcDashboardTotals,
        calcSlaPercent,
        getTicketsMetrics,
        type TicketsMetrics
    } from '$lib/utils/admin/statics/dashboard';
    import { generateStatisticsReport } from '$lib/utils/admin/statics/report';

    let fromDate: string = '';
    let toDate: string = '';

    let isGeneratingStatistics: boolean = false;
    let isDashboardLoading: boolean = false;
    let dashboardError: string = '';
    let metrics: TicketsMetrics[] = [];

    const chartWidth: number = 820;
    const chartHeight: number = 250;
    const chartPaddingX: number = 40;
    const chartPaddingY: number = 20;
    const chartGridSteps: number = 5;

    const monthNames: string[] = [
        'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
        'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'
    ];

    $: dashboardTotals = calcDashboardTotals(metrics);
    $: slaPercent = calcSlaPercent(dashboardTotals.closed, dashboardTotals.slaBreaches);
    $: slaRingPercent = Math.min(100, Math.max(0, slaPercent));
    $: slaInTimeCount = Math.max(0, dashboardTotals.closed - dashboardTotals.slaBreaches);

    $: maxTicketsCount = Math.max(
        1,
        ...metrics.flatMap((item) => [item.total, item.closed])
    );

    $: frtSeries = [
        { key: 'avg_frt', label: 'AVG', color: '#075CEF' },
        { key: 'p50_frt', label: 'P50', color: '#16A34A' },
        { key: 'p90_frt', label: 'P90', color: '#F59E0B' },
        { key: 'p95_frt', label: 'P95', color: '#EF4444' }
    ] as const;

    $: mttrSeries = [
        { key: 'avg_mttr', label: 'AVG', color: '#075CEF' },
        { key: 'p50_mttr', label: 'P50', color: '#16A34A' },
        { key: 'p90_mttr', label: 'P90', color: '#F59E0B' },
        { key: 'p95_mttr', label: 'P95', color: '#EF4444' }
    ] as const;

    $: maxFrt = Math.max(
        1,
        ...metrics.flatMap((item) => [item.avg_frt, item.p50_frt, item.p90_frt, item.p95_frt])
    );

    $: maxMttr = Math.max(
        1,
        ...metrics.flatMap((item) => [item.avg_mttr, item.p50_mttr, item.p90_mttr, item.p95_mttr])
    );

    $: ticketsGrid = buildGridValues(maxTicketsCount, chartGridSteps);
    $: frtGrid = buildGridValues(maxFrt, chartGridSteps);
    $: mttrGrid = buildGridValues(maxMttr, chartGridSteps);

    $: latestFrtSummary = {
        avg: getLatestNonZeroMetric(metrics, 'avg_frt'),
        p50: getLatestNonZeroMetric(metrics, 'p50_frt'),
        p90: getLatestNonZeroMetric(metrics, 'p90_frt'),
        p95: getLatestNonZeroMetric(metrics, 'p95_frt')
    };

    $: latestMttrSummary = {
        avg: getLatestNonZeroMetric(metrics, 'avg_mttr'),
        p50: getLatestNonZeroMetric(metrics, 'p50_mttr'),
        p90: getLatestNonZeroMetric(metrics, 'p90_mttr'),
        p95: getLatestNonZeroMetric(metrics, 'p95_mttr')
    };

    /**
     * Асинхронная функция для создания отчёта. Устанавливает флаг isGeneratingStatistics в true, 
     * вызывает функцию generateStatisticsReport с указанными датами,
     * и сбрасывает флаг isGeneratingStatistics в false после завершения.
     */
    async function createReport() {
        isGeneratingStatistics = true;
        try {
            await generateStatisticsReport(fromDate, toDate);
        } finally {
            isGeneratingStatistics = false;
        }
    }

    /**
     * Асинхронная функция для загрузки данных дашборда. Устанавливает флаг isDashboardLoading в true,
     * очищает возможные ошибки, загружает метрики с помощью getTicketsMetrics и сохраняет их в переменную metrics. 
     * @throws {Error} - Если при загрузке метрик возникает ошибка, сохраняет сообщение об ошибке в dashboardError.
     * @returns {Promise<void>} - Возвращает промис, который разрешается после завершения загрузки метрик и обновления состояния.
     */
    async function loadDashboard(): Promise<void> {
        isDashboardLoading = true;
        dashboardError = '';

        try {
            metrics = await getTicketsMetrics();
        } catch (error) {
            metrics = [];
            dashboardError = error instanceof Error
                ? error.message
                : 'Не удалось загрузить метрики';
        } finally {
            isDashboardLoading = false;
        }
    }

    /**
     * Функция для форматирования числа в строку с одним десятичным знаком и добавлением символа процента.
     * @param {number} value - Число для форматирования.
     * @returns {string} - Отформатированная строка с символом процента.
     */
    function toPercent(value: number): string {
        return `${ value.toFixed(1) }%`;
    }

    /**
     * Функция для получения текстовой метки месяца по его числовому представлению.
     * @param {number} month - Числовое представление месяца (1-12).
     * @returns {string} - Текстовая метка месяца.
     */
    function monthLabel(month: number): string {
        if (month < 1 || month > 12) return String(month);
        return monthNames[month - 1];
    }

    /**
     * Функция для преобразования количества секунд в строку формата "Xч Yм". 
     * Если количество часов равно нулю, отображается только количество минут.
     * @param {number} seconds - Количество секунд для преобразования.
     * @returns {string} - Строка в формате "Xч Yм" или "Yм", если часов нет. 
     */
    function toDuration(seconds: number): string {
        if (!seconds) return '0м';

        const totalSeconds = Math.max(0, Math.round(seconds));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        if (hours > 0) return `${ hours }ч ${ minutes }м`;
        return `${ Math.max(1, minutes) }м`;
    }

    /**
     * Функция для расчёта высоты столбца в диаграмме на основе его значения и максимального значения в серии.
     * @param {number} value - Значение столбца.
     * @param {number} maxValue - Максимальное значение в серии.
     * @returns {number} - Высота столбца в процентах.
     */
    function barHeight(value: number, maxValue: number): number {
        if (!maxValue) return 0;
        return (value / maxValue) * 100;
    }

    /**
     * Функция для построения строки координат для элемента <polyline> в SVG на основе массива значений и максимального значения для нормализации.
     * @param {number[]} values - Массив значений для построения полилинии.
     * @param {number} maxValue - Максимальное значение для нормализации координат по оси Y.
     * @returns {string} - Строка координат для атрибута points элемента <polyline>.
     */
    function buildPolyline(values: number[], maxValue: number): string {
        if (!values.length) return '';

        const startX = chartPaddingX;
        const endX = chartWidth - chartPaddingX;
        const innerWidth = Math.max(1, endX - startX);
        const innerHeight = Math.max(1, chartHeight - chartPaddingY * 2);

        return values
            .map((value, index) => {
                const denominator = Math.max(1, values.length - 1);
                const x = startX + (innerWidth * index) / denominator;
                const normalized = maxValue ? value / maxValue : 0;
                const y = chartHeight - chartPaddingY - normalized * innerHeight;
                return `${ x.toFixed(2) },${ y.toFixed(2) }`;
            })
            .join(' ');
    }

    /**
     * Функция для извлечения последнего ненулевого значения метрики из массива точек. 
     * Проходит по массиву в обратном порядке и возвращает первое найденное значение, которое больше нуля.
     * @param {TicketsMetrics[]} points - Массив точек метрик.
     * @param {'avg_frt' | 'p50_frt' | 'p90_frt' | 'p95_frt' | 'avg_mttr' | 'p50_mttr' | 'p90_mttr' | 'p95_mttr'} key 
     *  - Ключ метрики для извлечения значения.
     * @returns {number} - Последнее ненулевое значение метрики или 0, если таких значений нет.
     */
    function buildSeriesValues(
        points: TicketsMetrics[],
        key: 'avg_frt' | 'p50_frt' | 'p90_frt' | 'p95_frt' | 'avg_mttr' | 'p50_mttr' | 'p90_mttr' | 'p95_mttr'
    ): number[] {
        return points.map((item) => item[key]);
    }

    /**
     * Функция для получения последнего ненулевого значения метрики из массива точек.
     * @param {TicketsMetrics[]} points - Массив точек метрик.
     * @param {'avg_frt' | 'p50_frt' | 'p90_frt' | 'p95_frt' | 'avg_mttr' | 'p50_mttr' | 'p90_mttr' | 'p95_mttr'} key 
     *  - Ключ метрики для извлечения значения.
     * @returns {number} - Последнее ненулевое значение метрики или 0, если таких значений нет.
     */
    function getLatestNonZeroMetric(
        points: TicketsMetrics[],
        key: 'avg_frt' | 'p50_frt' | 'p90_frt' | 'p95_frt' | 'avg_mttr' | 'p50_mttr' | 'p90_mttr' | 'p95_mttr'
    ): number {
        for (let index = points.length - 1; index >= 0; index--) {
            const value = points[index][key];
            if (value > 0) return value;
        }

        return points.length > 0 ? points[points.length - 1][key] : 0;
    }

    /**
     * Функция для построения массива значений для сетки диаграммы на основе максимального значения и количества шагов.
     * @param {number} maxValue - Максимальное значение для построения сетки.
     * @param {number} steps - Количество шагов сетки.
     * @returns {number[]} - Массив значений для сетки диаграммы.
     */
    function buildGridValues(maxValue: number, steps: number): number[] {
        const safeSteps = Math.max(1, steps);
        return Array.from({ length: safeSteps + 1 }, (_, index) => {
            const factor = (safeSteps - index) / safeSteps;
            return Math.round(maxValue * factor);
        });
    }

    /**
     * Функция для расчёта координаты Y на диаграмме на основе значения и максимального значения для нормализации.
     * @param {number} value - Значение для расчёта координаты Y.
     * @param {number} maxValue - Максимальное значение для нормализации.
     * @returns {number} - Координата Y на диаграмме.
     */
    function chartY(value: number, maxValue: number): number {
        const innerHeight = Math.max(1, chartHeight - chartPaddingY * 2);
        const normalized = maxValue ? value / maxValue : 0;
        return chartHeight - chartPaddingY - normalized * innerHeight;
    }

    /**
     * Асинхронная функция, которая выполняется при монтировании компонента. Устанавливает начальные значения для fromDate и toDate,
     * и вызывает функцию loadDashboard для загрузки данных дашборда.
    */
    onMount(() => {
        const today = new Date().toISOString().split('T')[0];
        fromDate = today;
        toDate = today;

        void loadDashboard();
    });
</script>

<div class="statistics-section">
    <h1>Статистика</h1>

    <div class="dashboard-section">
        {#if dashboardError}
            <p class="dashboard-error">{ dashboardError }</p>
        {/if}

        {#if !isDashboardLoading && metrics.length === 0}
            <div class="empty-state">Нет данных для отображения графиков</div>
        {:else if metrics.length > 0}
            <div class="dashboard-grid">
                <div class="sla-card">
                    <div class="sla-layout">
                        <div class="sla-main">
                            <div>
                            <div class="sla-title">SLA</div>
                            <div class="sla-value">{ toPercent(slaPercent) }</div>
                            </div>

                            <div class="sla-caption">
                                Нарушений SLA: <strong>{ dashboardTotals.slaBreaches }</strong> из <strong>{ dashboardTotals.closed }</strong>
                            </div>
                        </div>

                        <div class="sla-donut-wrap" title={ `SLA: ${toPercent(slaPercent)}` }>
                            <div class="sla-donut-frame">
                                <svg class="sla-donut" viewBox="0 0 42 42" role="img" aria-label="Круговая диаграмма SLA">
                                    <circle class="sla-donut-track" cx="21" cy="21" r="15.915" />
                                    <circle
                                        class="sla-donut-sla"
                                        cx="21"
                                        cy="21"
                                        r="15.915"
                                        stroke-dasharray={ `${slaRingPercent} ${100 - slaRingPercent}` }
                                    />
                                </svg>
                                <div class="sla-donut-center">
                                    <div class="sla-donut-main">{ slaInTimeCount }</div>
                                    <div class="sla-donut-sub">в SLA из { dashboardTotals.closed }</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="chart-card">
                    <h4>Поступившие / выполненные заявки</h4>
                    <div class="bars-chart">
                        <div class="bars-y-scale">
                            {#each ticketsGrid as value}
                                <span>{ value }</span>
                            {/each}
                        </div>

                        <div class="bars-wrapper">
                            <div class="bars-grid" aria-hidden="true">
                                {#each ticketsGrid as _, index}
                                    <div class="bars-grid-line" style={ `top: ${(index / chartGridSteps) * 100}%` }></div>
                                {/each}
                            </div>

                            {#each metrics as item}
                                <div class="bar-group">
                                    <div class="bars">
                                        <div
                                            class="bar total"
                                            style="height: { barHeight(item.total, maxTicketsCount) }%"
                                            title={ `Поступило: ${ item.total }` }
                                        ></div>
                                        <div
                                            class="bar closed"
                                            style="height: { barHeight(item.closed, maxTicketsCount) }%"
                                            title={ `Выполнено: ${ item.closed }` }
                                        ></div>
                                    </div>
                                    <div class="bar-label">{ monthLabel(item.month) }</div>
                                </div>
                            {/each}
                        </div>
                    </div>

                    <div class="legend">
                        <span><i class="dot total"></i>Поступившие</span>
                        <span><i class="dot closed"></i>Выполненные</span>
                    </div>
                </div>

                <div class="chart-card">
                    <h4>График FRT</h4>
                    <svg
                        class="line-chart"
                        viewBox={ `0 0 ${ chartWidth } ${ chartHeight }` }
                        role="img"
                        aria-label="График FRT"
                    >
                        {#each frtGrid as value}
                            <line
                                x1={ chartPaddingX }
                                y1={ chartY(value, maxFrt) }
                                x2={ chartWidth - chartPaddingX }
                                y2={ chartY(value, maxFrt) }
                                class="grid-line"
                            />
                            <text x="6" y={ chartY(value, maxFrt) + 4 } class="grid-label">
                                { toDuration(value) }
                            </text>
                        {/each}

                        <line x1={ chartPaddingX } y1={ chartHeight - chartPaddingY } x2={ chartWidth - chartPaddingX } y2={ chartHeight - chartPaddingY } class="axis" />
                        <line x1={ chartPaddingX } y1={ chartPaddingY } x2={ chartPaddingX } y2={ chartHeight - chartPaddingY } class="axis" />

                        {#each frtSeries as series}
                            <polyline
                                fill="none"
                                stroke={ series.color }
                                stroke-width="3"
                                points={ buildPolyline(buildSeriesValues(metrics, series.key), maxFrt) }
                            />
                        {/each}
                    </svg>

                    <div class="chart-x-labels">
                        {#each metrics as item}
                            <span>{ monthLabel(item.month) }</span>
                        {/each}
                    </div>

                    <div class="legend">
                        {#each frtSeries as series}
                            <span><i class="dot" style={ `background:${series.color}` }></i>{ series.label }</span>
                        {/each}
                    </div>

                    <div class="chart-summary">
                        <span>AVG: { toDuration(latestFrtSummary.avg) }</span>
                        <span>P50: { toDuration(latestFrtSummary.p50) }</span>
                        <span>P90: { toDuration(latestFrtSummary.p90) }</span>
                        <span>P95: { toDuration(latestFrtSummary.p95) }</span>
                    </div>
                </div>

                <div class="chart-card">
                    <h4>График MTTR</h4>
                    <svg
                        class="line-chart"
                        viewBox={ `0 0 ${ chartWidth } ${ chartHeight }` }
                        role="img"
                        aria-label="График MTTR"
                    >
                        {#each mttrGrid as value}
                            <line
                                x1={ chartPaddingX }
                                y1={ chartY(value, maxMttr) }
                                x2={ chartWidth - chartPaddingX }
                                y2={ chartY(value, maxMttr) }
                                class="grid-line"
                            />
                            <text x="6" y={ chartY(value, maxMttr) + 4 } class="grid-label">
                                { toDuration(value) }
                            </text>
                        {/each}

                        <line x1={ chartPaddingX } y1={ chartHeight - chartPaddingY } x2={ chartWidth - chartPaddingX } y2={ chartHeight - chartPaddingY } class="axis" />
                        <line x1={ chartPaddingX } y1={ chartPaddingY } x2={ chartPaddingX } y2={ chartHeight - chartPaddingY } class="axis" />

                        {#each mttrSeries as series}
                            <polyline
                                fill="none"
                                stroke={ series.color }
                                stroke-width="3"
                                points={ buildPolyline(buildSeriesValues(metrics, series.key), maxMttr) }
                            />
                        {/each}
                    </svg>

                    <div class="chart-x-labels">
                        {#each metrics as item}
                            <span>{ monthLabel(item.month) }</span>
                        {/each}
                    </div>

                    <div class="legend">
                        {#each mttrSeries as series}
                            <span><i class="dot" style={ `background:${series.color}` }></i>{ series.label }</span>
                        {/each}
                    </div>

                    <div class="chart-summary">
                        <span>AVG: { toDuration(latestMttrSummary.avg) }</span>
                        <span>P50: { toDuration(latestMttrSummary.p50) }</span>
                        <span>P90: { toDuration(latestMttrSummary.p90) }</span>
                        <span>P95: { toDuration(latestMttrSummary.p95) }</span>
                    </div>
                </div>
            </div>
        {/if}
    </div>
    
    <div class="generate-report-section">
        <h3>Формирование отчёта</h3>
        <div class="generate-statistics-form">
            <div class="statistics-row">
                <div class="form-group">
                    <label for="fromDate">С даты</label>
                    <input 
                        type="date" 
                        id="fromDate" 
                        placeholder="С даты" 
                        bind:value={ fromDate }
                        class="form-input"
                    />
                    <label for="toDate">По дату</label>
                    <input 
                        type="date" 
                        id="toDate" 
                        placeholder="По дату" 
                        bind:value={ toDate }
                        class="form-input"
                    />
                </div>
                
                <button 
                    class="btn btn-primary" 
                    on:click={ createReport } 
                    disabled={ isGeneratingStatistics || !fromDate.trim() || !toDate.trim() }
                >
                    { isGeneratingStatistics ? 'Формирование...' : 'Сформировать' }
                </button>
            </div>
            <p class="help-text">Сформировать отчёт о количестве выполненных сотрудниками задач</p>
        </div>
    </div>
</div>

<style global>
    @import './Statistic.css';
</style>