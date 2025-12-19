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
    department: Department,
    cabinet: string
};

export type Building = { 
    id: number; 
    code: string; 
    name: string 
};

export type Department = {
    id: number;
    name: string;
};

export type OrderBy = {
    id: number;
    name: string;
}

export type TicketsFilters = {
    search: string;
    viewMode: ViewMode;
    sortOrder: SortOrder;
    selectedStatus: string[];
    selectedBuildings: string[];
    plannedFrom: string;
    plannedTo: string;
    page_size: number;
    department: number;
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

export interface Message {
    id: number;
    user: { id: number; name: string };
    text: string;
    is_internal: boolean;
    created_at: string;
}

export interface GetMessagesParams {
    before?: number;
    after?: number;
    limit?: number;
}

export interface CreateMessageParams {
    message: string;
    is_internal?: boolean;
}

// Consts
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