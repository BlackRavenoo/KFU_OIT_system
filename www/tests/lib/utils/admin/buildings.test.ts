import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';

vi.mock('$lib/utils/api', () => ({
    api: {
        post: vi.fn(),
        put: vi.fn()
    }
}));

vi.mock('$lib/utils/tickets/api/get', () => ({
    fetchConsts: vi.fn()
}));

import { api } from '$lib/utils/api';
import { fetchConsts } from '$lib/utils/tickets/api/get';
import { createBuilding, updateBuilding, toggleBuildingActive } from '$lib/utils/admin/buildings';

const mockApi = api as unknown as {
    post: Mock;
    put: Mock;
};

const mockFetchConsts = fetchConsts as Mock;

beforeEach(() => {
    vi.resetAllMocks();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Create buildings', () => {
    it('Calls api and fetch consts successfully (201)', async () => {
        mockApi.post.mockResolvedValue({ success: true, status: 201, data: { id: 1, code: 'A', name: 'B' } });
        await createBuilding('A', 'B');
        
        expect(mockApi.post).toHaveBeenCalledTimes(1);
        expect(mockApi.post).toHaveBeenCalledWith('/api/v1/buildings/', { code: 'A', name: 'B' });
        expect(mockFetchConsts).toHaveBeenCalledTimes(1);
        expect(mockFetchConsts).toHaveBeenCalledWith(true);
    });

    it('Calls api and fetch consts successfully (200)', async () => {
        mockApi.post.mockResolvedValue({ success: true, status: 200, data: {} });
        await createBuilding('X', 'Y');
        
        expect(mockApi.post).toHaveBeenCalledWith('/api/v1/buildings/', { code: 'X', name: 'Y' });
        expect(mockFetchConsts).toHaveBeenCalledTimes(1);
    });

    it('Throws with server error message', async () => {
        mockApi.post.mockResolvedValue({ success: false, status: 400, error: 'bad input' });
        
        await expect(createBuilding('C', 'D')).rejects.toThrow(/bad input/);
        expect(mockFetchConsts).not.toHaveBeenCalled();
    });

    it('Throws default message', async () => {
        mockApi.post.mockResolvedValue({ success: true, status: 204 });
        
        await expect(createBuilding('C', 'D')).rejects.toThrow(/Ошибка при создании здания/);
        expect(mockFetchConsts).not.toHaveBeenCalled();
    });
    
    it('Propagates thrown errors from api', async () => {
        mockApi.post.mockRejectedValue(new Error('network down'));
        
        await expect(createBuilding('Z', 'Q')).rejects.toThrow(/network down/);
        expect(mockFetchConsts).not.toHaveBeenCalled();
    });
});

describe('Update building', () => {
    it('Calls api and fetch consts successfully (200)', async () => {
        mockApi.put.mockResolvedValue({ success: true, status: 200 });
        await updateBuilding(5, 'C1', 'Name1');
        
        expect(mockApi.put).toHaveBeenCalledTimes(1);
        expect(mockApi.put).toHaveBeenCalledWith('/api/v1/buildings/5', { code: 'C1', name: 'Name1' });
        expect(mockFetchConsts).toHaveBeenCalledTimes(1);
    });

    it('Throws when response indicates failure', async () => {
        mockApi.put.mockResolvedValue({ success: false, status: 422, error: 'invalid' });
        
        await expect(updateBuilding('abc', 'C', 'N')).rejects.toThrow(/invalid/);
        expect(mockFetchConsts).not.toHaveBeenCalled();
    });

    it('Throws when status not 200/201 despite success true', async () => {
        mockApi.put.mockResolvedValue({ success: true, status: 500 });
    
        await expect(updateBuilding(7, 'c', 'n')).rejects.toThrow(/Ошибка при обновлении здания/);
        expect(mockFetchConsts).not.toHaveBeenCalled();
    });

    it('Propagates api rejection', async () => {
        mockApi.put.mockRejectedValue(new Error('timeout'));
    
        await expect(updateBuilding(8, 'c', 'n')).rejects.toThrow(/timeout/);
        expect(mockFetchConsts).not.toHaveBeenCalled();
    });
});

describe('Toggle building active', () => {
    it('Calls api and fetch consts successfully (200)', async () => {
        mockApi.post.mockResolvedValue({ success: true, status: 200 });
        await toggleBuildingActive(9);
        
        expect(mockApi.post).toHaveBeenCalledWith('/api/v1/buildings/9/toggle_active', {});
        expect(mockFetchConsts).toHaveBeenCalledTimes(1);
        expect(mockFetchConsts).toHaveBeenCalledWith(true);
    });

    it('Throws when server returns failure', async () => {
        mockApi.post.mockResolvedValue({ success: false, status: 400, error: 'cannot toggle' });
    
        await expect(toggleBuildingActive(10)).rejects.toThrow(/cannot toggle/);
        expect(mockFetchConsts).not.toHaveBeenCalled();
    });

    it('Throws when success true but non-200/201 status', async () => {
        mockApi.post.mockResolvedValue({ success: true, status: 202 });
    
        await expect(toggleBuildingActive(11)).rejects.toThrow(/Ошибка при деактивации здания/);
        expect(mockFetchConsts).not.toHaveBeenCalled();
    });

    it('Propagates api rejection', async () => {
        mockApi.post.mockRejectedValue(new Error('conn refused'));
    
        await expect(toggleBuildingActive(12)).rejects.toThrow(/conn refused/);
        expect(mockFetchConsts).not.toHaveBeenCalled();
    });
});