import { api } from '$lib/utils/api';
import { toApiColor } from '$lib/utils/assets/helpers';
import type {
    AssetStatus,
    CreateStatusPayload,
    GetStatusesParams,
    PaginatedResponse,
    UpdateStatusPayload,
} from '$lib/utils/assets/types';

// Базовый URL для API-операций со статусами активов.
const BASE = '/api/v1/assets/statuses';

/**
 * Получает список статусов активов.
 * Если передан `page_size`, значение ограничивается диапазоном от 10 до 100.
 * @param params Параметры запроса списка статусов.
 * @returns Запрос, возвращающий пагинированный список статусов.
 */
export function getStatuses(params?: GetStatusesParams) {
    const pageSize = params?.page_size;

    return api.get<PaginatedResponse<AssetStatus>>(BASE, {
        ...(params ?? {}),
        ...(typeof pageSize === 'number'
            ? { page_size: Math.max(10, Math.min(100, pageSize)) }
            : {}),
    });
}

/**
 * Создаёт новый статус актива.
 * Перед отправкой цвет приводится к формату API через `toApiColor`.
 * @param payload Данные для создания статуса.
 * @returns Запрос, возвращающий идентификатор созданного статуса.
 */
export function createStatus(payload: CreateStatusPayload) {
    return api.post<{ id: number }>(BASE, {
        ...payload,
        color: toApiColor(payload.color),
    });
}

/**
 * Обновляет существующий статус актива.
 * Если в полезной нагрузке указан цвет, он приводится к формату API
 * через `toApiColor`.
 * @param statusId Идентификатор обновляемого статуса.
 * @param payload Поля для обновления статуса.
 * @returns Запрос на обновление статуса.
 */
export function updateStatus(statusId: number, payload: UpdateStatusPayload) {
    const preparedPayload: UpdateStatusPayload = { ...payload };
    if (preparedPayload.color) preparedPayload.color = toApiColor(preparedPayload.color);
    return api.put(`${BASE}/${statusId}`, preparedPayload);
}

/**
 * Удаляет статус актива по идентификатору.
 * @param statusId Идентификатор удаляемого статуса.
 * @returns Запрос на удаление статуса.
 */
export function deleteStatus(statusId: number) {
    return api.delete(`${BASE}/${statusId}`);
}
