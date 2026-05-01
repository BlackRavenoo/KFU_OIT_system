import { api } from '$lib/utils/api';

const BASE = '/api/v1/tickets';

/**
 * Интерфейс для прикрепления актива к заявке
 */
export type AttachTicketAssetPayload = {
    asset_id: number;
    comment?: string;
};

/**
 * Интерфейс для ответа при получении активов, прикрепленных к заявке
 */
export type TicketAssetResponse = {
    id: number;
    name: string;
    inventory_number?: string;
    serial_number?: string;
    location?: string;
    comment?: string;
};

/**
 * Получение активов, прикрепленных к заявке
 * @param {number | string} ticketId id тикета
 * @returns {Promise<TicketAssetResponse[]>} список активов
 */
export function getTicketAssets(ticketId: number | string) {
    return api.get<TicketAssetResponse[]>(`${BASE}/${ticketId}/assets`);
}

/**
 * Прикрепление актива к заявке
 * @param {number | string} ticketId id тикета
 * @param {AttachTicketAssetPayload} payload данные для прикрепления актива
 * @returns {Promise<void>} результат операции
 */
export function attachAssetToTicket(ticketId: number | string, payload: AttachTicketAssetPayload) {
    return api.post(`${BASE}/${ticketId}/assets`, payload);
}

/**
 * Удаление прикрепленного актива от заявки
 * @param {number | string} ticketId id тикета
 * @param {number | string} assetId id актива
 * @returns {Promise<void>} результат операции
 */
export function deleteTicketAsset(ticketId: number | string, assetId: number | string) {
    return api.delete(`${BASE}/${ticketId}/assets/${assetId}`);
}
