/**
 * @file stores.ts
 * Хранит глобальные состояния для приложения.
 * Используется для управления заголовком страницы и описанием.
 */
import { writable } from 'svelte/store';
import type { Building, OrderBy } from '$lib/utils/tickets/types';

export const pageTitle = writable('ОИТ | Система управления заявками ЕИ КФУ');
export const pageDescription = writable('Система обработки заявок Отдела Информационных Технологий Елабужского института Казанского Федерального Университета. Система позволяет создавать заявки на услуги ОИТ, отслеживать их статус, получать советы для самостоятельного решения проблемы и многое другое.');

export const buildings = writable<Building[]>([]);
export const order = writable<OrderBy[]>([]);