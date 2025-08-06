import type { TicketsApiEndpoints } from '$lib/utils/tickets/types';

export const AUTH_BASE_PATH = '/api/v1/tickets';

export const TICKETS_API_ENDPOINTS: TicketsApiEndpoints = {
    create: `${AUTH_BASE_PATH}/`,
    read: `${AUTH_BASE_PATH}/`,
    update: `${AUTH_BASE_PATH}/`,
    delete: `${AUTH_BASE_PATH}/`,
    consts: `${AUTH_BASE_PATH}/consts`,
    attachments: `/api/v1/images/attachments`,
};