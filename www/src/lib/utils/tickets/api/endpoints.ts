import type { ITicketsApiEndpoints } from '$lib/utils/tickets/types';

export const AUTH_BASE_PATH = '/api/v1/tickets';

export const TICKETS_API_ENDPOINTS: ITicketsApiEndpoints = {
    create: `${AUTH_BASE_PATH}/`,
    read: `${AUTH_BASE_PATH}/`,
    update: `${AUTH_BASE_PATH}/`,
    delete: `${AUTH_BASE_PATH}/`
};