/**
 * @file tickets.types.ts
 * Типы и абстракции для авторизации пользователей.
 * Только определения интерфейсов, типов и абстракций — без конкретных реализаций!
 */

// Types
export type UiStatus = 'all' | 'open' | 'inprogress' | 'closed' | 'cancelled';
export type PriorityStatus = 'low' | 'medium' | 'high' | 'critical' | 'expired' | 'cancelled' | 'complete';
export type ViewMode = 'cards' | 'list';
export type SortOrder = 'asc' | 'desc';

// Interfaces
export interface ITicketsApiEndpoints {
    create: string;
    read: string;
    update: string;
    delete: string;
    consts: string
}

interface StatusOption {
    value: UiStatus | PriorityStatus;
    label: string;
    serverValue: string | null;
}

export interface TicketsFilters {
    search: string;
    viewMode: ViewMode;
    sortOrder: SortOrder;
    selectedStatus: string;
    selectedBuildings: string[];
    plannedFrom: string;
    plannedTo: string;
    page_size: number;
    selectedSort: number;
}

export interface ITicketsFiltersStorage {
    get(): TicketsFilters;
    set(filters: TicketsFilters): void;
    clear(): void;
}

// Consts
export const orderByMap: Record<number, string> = {
    0: 'id',
    1: 'plannedat',
    2: 'priority'
};

export const statusOptions: StatusOption[] = [
    { value: 'all', label: 'Все', serverValue: null },
    { value: 'open', label: 'Активные', serverValue: 'Open' },
    { value: 'inprogress', label: 'В процессе', serverValue: 'InProgress' },
    { value: 'closed', label: 'Выполненные', serverValue: 'Closed' },
    { value: 'cancelled', label: 'Отклонённые', serverValue: 'Cancelled' }
];

export const statusPriority: StatusOption[] = [
    { value: 'low', label: "Низкий", serverValue: 'Low' },
    { value: 'medium', label: "Средний", serverValue: 'Medium' },
    { value: 'high', label: "Высокий", serverValue: 'High' },
    { value: 'critical', label: "Срочный", serverValue: 'Critical' },
    { value: 'expired', label: "Истекло", serverValue: 'Expired' },
    { value: 'cancelled', label: "Отменён", serverValue: 'Cancelled' },
    { value: 'complete', label: "Завершён", serverValue: 'Complete' }
]