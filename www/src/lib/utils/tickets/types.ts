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

export type Ticket = {
    id: number,
    title: string,
    description: string,
    author: string,
    author_contacts: string,
    status: UiStatus,
    priority: PriorityStatus,
    planned_at: null | string,
    assigned_to: Array<{ id: string, name: string }>,
    created_at: string,
    attachments: null | any,
    building: Building,
    note: string,
    cabinet: string
};

export type Building = { 
    id: number; 
    code: string; 
    name: string 
};

export type OrderBy = {
    id: number;
    name: string;
}

export type TicketsFilters = {
    search: string;
    viewMode: ViewMode;
    sortOrder: SortOrder;
    selectedStatus: string;
    selectedBuildings: string[];
    plannedFrom: string;
    plannedTo: string;
    page_size: number;
    selectedSort: number;
    page: number;
};

type StatusOption = {
    value: UiStatus | PriorityStatus;
    label: string;
    serverValue: string | null;
};

export type TicketsApiEndpoints = {
    create: string;
    read: string;
    update: string;
    delete: string;
    consts: string;
    attachments: string;
}

// Interfaces
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
    { value: 'open', label: 'Активные', serverValue: 'open' },
    { value: 'inprogress', label: 'В процессе', serverValue: 'inprogress' },
    { value: 'closed', label: 'Выполненные', serverValue: 'closed' },
    { value: 'cancelled', label: 'Отклонённые', serverValue: 'cancelled' }
];

export const statusPriority: StatusOption[] = [
    { value: 'low', label: "Низкий", serverValue: 'low' },
    { value: 'medium', label: "Средний", serverValue: 'medium' },
    { value: 'high', label: "Высокий", serverValue: 'high' }
]