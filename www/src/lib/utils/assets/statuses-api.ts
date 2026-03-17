import { api } from '$lib/utils/api';
import { toApiColor } from '$lib/utils/assets/helpers';
import type {
    AssetStatus,
    CreateStatusPayload,
    GetStatusesParams,
    PaginatedResponse,
    UpdateStatusPayload,
} from '$lib/utils/assets/types';

const BASE = '/api/v1/assets/statuses';

export function getStatuses(params?: GetStatusesParams) {
    const pageSize = params?.page_size;

    return api.get<PaginatedResponse<AssetStatus>>(BASE, {
        ...(params ?? {}),
        ...(typeof pageSize === 'number'
            ? { page_size: Math.max(10, Math.min(100, pageSize)) }
            : {}),
    });
}

export function createStatus(payload: CreateStatusPayload) {
    return api.post<{ id: number }>(BASE, {
        ...payload,
        color: toApiColor(payload.color),
    });
}

export function updateStatus(statusId: number, payload: UpdateStatusPayload) {
    const preparedPayload: UpdateStatusPayload = { ...payload };
    if (preparedPayload.color) preparedPayload.color = toApiColor(preparedPayload.color);
    return api.put(`${BASE}/${statusId}`, preparedPayload);
}

export function deleteStatus(statusId: number) {
    return api.delete(`${BASE}/${statusId}`);
}
