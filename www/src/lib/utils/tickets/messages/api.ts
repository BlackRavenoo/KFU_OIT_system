import { api } from '$lib/utils/api';
import type { Message, CreateMessageParams, GetMessagesParams } from '$lib/utils/tickets/types';

const BASE = '/api/v1/tickets';

/**
 * Получение сообщений тикета
 * @param {number | string} ticketId id тикета
 * @param {GetMessagesParams} [params] параметры для получения сообщений
 * @returns {Promise<Message[]>} список сообщений
 */
export async function getMessages(ticketId: number | string, params?: GetMessagesParams) {
    return api.get<Message[]>(`${BASE}/${ticketId}/messages`, params ?? {});
}

/**
 * Создание сообщения тикета
 * @param {number | string} ticketId id тикета
 * @param {CreateMessageParams} data данные для создания сообщения
 * @returns {Promise<Message>} созданное сообщение
 */
export async function createMessage(ticketId: number | string, data: CreateMessageParams) {
    return api.post(`${BASE}/${ticketId}/messages`, data);
}

/** 
 * Удаление сообщения тикета
 * @param {number | string} ticketId id тикета
 * @param {number | string} messageId id сообщения
 * @returns {Promise<void>} результат удаления
 */
export async function deleteMessage(ticketId: number | string, messageId: number | string) {
    return api.delete(`${BASE}/${ticketId}/messages/${messageId}`);
}

/**
 * Подписка на сообщения тикета с автообновлением раз в 30 секунд.
 * @param {number | string} ticketId id тикета
 * @param {GetMessagesParams} [params] параметры для getMessages
 * @param {(messages: Message[]) => void} onUpdate колбэк, вызывается при каждом обновлении
 * @returns {() => void} функция для отмены подписки
 */
export function subscribeMessages(
    ticketId: number | string,
    params: GetMessagesParams | undefined,
    onUpdate: (messages: Message[]) => void
) {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
        const res = await getMessages(ticketId, params);
        if (res.success && Array.isArray(res.data)) onUpdate(res.data);
        timer = setTimeout(poll, 30000);
    }

    poll();

    return () => {
        stopped = true;
        if (timer) clearTimeout(timer);
        else console.warn('No timer to clear in subscribeMessages');
    };
}