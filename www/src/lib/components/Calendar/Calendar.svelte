<script lang="ts">
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import { fade } from 'svelte/transition';
    import { get } from 'svelte/store';
    import { page as pageStore } from '$app/stores';
    import { pageTitle, pageDescription } from '$lib/utils/setup/stores';
    import { isAuthenticated, currentUser } from '$lib/utils/auth/storage/initial';
    import { handleAuthError } from '$lib/utils/api';
    import { UserRole } from '$lib/utils/auth/types';
    import { formatDate } from '$lib/utils/validation/validate';
    import { normalizeDate } from '$lib/utils/tickets/support';
    import type { Ticket } from '$lib/utils/tickets/types';
    import { toKey, getWeekRange, buildDays, loadTicketsForRange } from './Calendar';

    export let open: boolean = false;
    export let initialStart: string;
    export let initialEnd: string;
    
    const dispatch = createEventDispatcher();

    let startDate: Date;
    let endDate: Date;
    let days: Date[] = [];
    const today = new Date();
    let ticketsByDate: Record<string, Ticket[]> = {};
    let loading = false;
    let error: string | null = null;

    let startInput = '';
    let endInput = '';

    function setRange(s: Date, e: Date) {
        startDate = new Date(s);
        startDate.setHours(0,0,0,0);
        endDate = new Date(e);
        endDate.setHours(23,59,59,999);
        days = buildDays(startDate, endDate);
        startInput = toKey(startDate);
        endInput = toKey(endDate);
    }

    function prevWeek() {
        const s = new Date(startDate);
        s.setDate(s.getDate() - 7);
        const { start, end } = getWeekRange(s);
        setRange(start, end);
        void refreshTickets();
    }

    function nextWeek() {
        const s = new Date(startDate);
        s.setDate(s.getDate() + 7);
        const { start, end } = getWeekRange(s);
        setRange(start, end);
        void refreshTickets();
    }

    function onInputRangeChange() {
        const s = new Date(startInput);
        const e = new Date(endInput);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return;
        const start = new Date(s);
        start.setHours(0,0,0,0);
        const end = new Date(e);
        end.setHours(23,59,59,999);
        if (start > end) return;
        setRange(start, end);
        void refreshTickets();
    }

    function priorityClass(p?: string) {
        const key = String(p ?? '').toLowerCase();
        if (key === 'low') return 'priority-low';
        if (key === 'medium') return 'priority-medium';
        if (key === 'high') return 'priority-high';
        if (key === 'critical' || key === 'urgent') return 'priority-critical';
        return 'priority-normal';
    }

    function formatTimeFromIso(iso?: string) {
        if (!iso) return '';
        const n = normalizeDate(iso);
        if (!n) return '';
        const d = new Date(n);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    async function refreshTickets() {
        loading = true;
        error = null;
        ticketsByDate = {};
        try {
            ticketsByDate = await loadTicketsForRange(startDate, endDate);
        } catch (e) {
            error = e instanceof Error ? e.message : String(e);
        } finally {
            loading = false;
        }
    }

    function isToday(d: Date) {
        const t = new Date();
        return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
    }

    function backdropClick(e: MouseEvent) {
        if ((e.target as HTMLElement)?.classList?.contains('cal-backdrop')) close();
    }

    function backdropKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' || e.key === ' ') {
            if ((e.target as HTMLElement)?.classList?.contains('cal-backdrop')) {
                close();
            }
        }
    }

    function onKey(e: KeyboardEvent) {
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowLeft') prevWeek();
        if (e.key === 'ArrowRight') nextWeek();
    }

    function close() {
        dispatch('close');
    }

    onMount(() => {
        if (!$isAuthenticated || $currentUser === null || $currentUser.role === UserRole.Client) {
            handleAuthError(get(pageStore).url.pathname);
            return;
        }

        if (initialStart && initialEnd) {
            const s = new Date(initialStart);
            const e = new Date(initialEnd);
            if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s <= e) {
                setRange(s, e);
            } else {
                const { start, end } = getWeekRange(today);
                setRange(start, end);
            }
        } else {
            const { start, end } = getWeekRange(today);
            setRange(start, end);
        }

        void refreshTickets();
        pageTitle.set('Календарь | Система управления заявками ЕИ КФУ');
        pageDescription.set('Календарь заявок — просматривайте распределение заявок по дням недели и диапазонам дат.');

        window.addEventListener('keydown', onKey);
    });

    onDestroy(() => {
        window.removeEventListener('keydown', onKey);
    });
</script>

{#if open}
    <div
        class="cal-backdrop"
        on:click={backdropClick}
        on:keydown={backdropKeydown}
        tabindex="0"
        role="button"
        transition:fade>
        <div class="cal-modal" role="dialog" aria-modal="true" transition:fade>
            <div class="cal-header">
                <h3>Календарь заявок</h3>
                <button class="close-btn" on:click={close} aria-label="Закрыть">✕</button>
            </div>

            <div class="controls">
                <button class="arrow-btn" on:click={ prevWeek } aria-label="Предыдущая неделя">←</button>

                <div class="range-inputs">
                    <input id="start" type="date" bind:value={ startInput } on:change={ onInputRangeChange } />
                    <label class="range-sep" for="end">-</label>
                    <input id="end" type="date" bind:value={ endInput } on:change={ onInputRangeChange } />
                </div>

                <button class="arrow-btn" on:click={ nextWeek } aria-label="Следующая неделя">→</button>
            </div>

            <div class="week-grid" class:loading={loading}>
                {#each days as day}
                    <div class="day-card" class:today={isToday(day)} role="group" aria-label={"День " + toKey(day)}>
                        <div class="day-header">
                            <div class="day-label">{ day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) }</div>
                            <div class="day-key">{ toKey(day) }</div>
                        </div>

                        {#if loading}
                            <div class="ticket-list">Загрузка…</div>
                        {:else}
                            <div class="ticket-list">
                                {#if ticketsByDate[toKey(day)] && ticketsByDate[toKey(day)].length > 0}
                                    {#each ticketsByDate[toKey(day)] as t}
                                        <a
                                            class={"ticket-link " + priorityClass(t.priority)}
                                            href={"/ticket/" + t.id}>
                                            <div class="ticket-time">{ formatTimeFromIso(t.planned_at || t.created_at) }</div>
                                            <div class="ticket-meta">
                                                <div class="ticket-top">{ (t.building?.code ?? '') + '-' + t.id }</div>
                                                <div class="ticket-sub">{ formatDate(t.planned_at || t.created_at || '') }</div>
                                            </div>
                                            <div class="ticket-title" title={t.title}>{ t.title }</div>
                                        </a>
                                    {/each}
                                {:else}
                                    <div class="no-tickets">Нет заявок</div>
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    </div>
{/if}

<style>
    @import './Calendar.css';
</style>