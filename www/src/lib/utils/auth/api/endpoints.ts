import type { IAuthApiEndpoints } from '../types';

export const AUTH_BASE_PATH = '/api/v1/auth';

export const AUTH_API_ENDPOINTS: IAuthApiEndpoints = {
    login: `${AUTH_BASE_PATH}/login`,
    logout: `${AUTH_BASE_PATH}/logout`,
    refresh: `${AUTH_BASE_PATH}/token`,
    getUserData: `${AUTH_BASE_PATH}/me`,
    requestRecovery: `${AUTH_BASE_PATH}/recovery/request`,
    validateRecovery: `${AUTH_BASE_PATH}/recovery/validate`,
    confirmRecovery: `${AUTH_BASE_PATH}/recovery/confirm`
};