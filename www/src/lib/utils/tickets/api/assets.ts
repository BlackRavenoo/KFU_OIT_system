import { api } from '$lib/utils/api';

const BASE = '/api/v1/tickets';

export type AttachTicketAssetPayload = {
    asset_id: number;
    comment?: string;
};

export type TicketAssetResponse = {
    id: number;
    name: string;
    inventory_number?: string;
    serial_number?: string;
    location?: string;
    comment?: string;
};

export function getTicketAssets(ticketId: number | string) {
    return api.get<TicketAssetResponse[]>(`${BASE}/${ticketId}/assets`);
}

export function attachAssetToTicket(ticketId: number | string, payload: AttachTicketAssetPayload) {
    return api.post(`${BASE}/${ticketId}/assets`, payload);
}

export function deleteTicketAsset(ticketId: number | string, assetId: number | string) {
    return api.delete(`${BASE}/${ticketId}/assets/${assetId}`);
}
