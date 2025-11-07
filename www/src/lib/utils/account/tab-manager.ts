import { browser } from '$app/environment';
import { goto } from '$app/navigation';

// Типы вкладок
export const Tab = {
    PROFILE: 'profile',
    TICKETS: 'tickets',
    STATS: 'statistics',
    USERS: 'users',
    BOTS: 'bots',
    REQUEST: 'request',
    PAGES: 'pages'
} as const;

export type TabType = typeof Tab[keyof typeof Tab];

/**
 * Обновляет параметр 'tab' в URL без перезагрузки страницы.
 * @param tab - Выбранная вкладка.
 */
export function updateUrlParam(tab: TabType): void {
    if (browser) {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        goto(url.toString(), { replaceState: true, keepFocus: true });
    }
}

/**
 * Проверяет, является ли параметр допустимой вкладкой.
 * @param tabParam - Параметр для проверки
 */
export function isValidTab(tabParam: string): tabParam is TabType {
    return Object.values(Tab).includes(tabParam as TabType);
}