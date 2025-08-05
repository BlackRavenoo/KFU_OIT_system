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
    assigned_to: null | { id: string, name: string },
    created_at: string,
    attachments: null | any
}

// Interfaces
export interface ITicketsApiEndpoints {
    create: string;
    read: string;
    update: string;
    delete: string;
    consts: string;
    attachments: string;
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

export interface IBuilding {
    id: string;
    name: string;
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
    { value: 'high', label: "Высокий", serverValue: 'high' },
    { value: 'critical', label: "Срочный", serverValue: 'critical' },
    { value: 'expired', label: "Истекло", serverValue: 'expired' },
    { value: 'cancelled', label: "Отменён", serverValue: 'cancelled' },
    { value: 'complete', label: "Завершён", serverValue: 'complete' }
]

export const buildingOptions: IBuilding[] = [
    { id: 'building-1', name: 'Главный корпус' },
    { id: 'building-2', name: 'Биофак' },
    { id: 'building-3', name: 'Психфак' },
    { id: 'building-4', name: 'Школа' },
    { id: 'building-5', name: 'УСК' },
    { id: 'building-6', name: 'Общежитие №1' },
    { id: 'building-7', name: 'Общежитие №2' },
    { id: 'building-8', name: 'Кафе' },
    { id: 'building-9', name: 'Буревестник' }
]