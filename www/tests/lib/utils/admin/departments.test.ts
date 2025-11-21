import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiMock = {
    post: vi.fn(),
    put: vi.fn()
};
const fetchConstsMock = vi.fn();

vi.mock('$lib/utils/api', () => ({ api: apiMock }));
vi.mock('$lib/utils/tickets/api/get', () => ({ fetchConsts: fetchConstsMock }));

beforeEach(() => {
    vi.clearAllMocks();
});

describe('Departments functions', () => {
    it('Create department successfully', async () => {
        apiMock.post.mockResolvedValue({ success: true, status: 200, data: { id: 1, name: 'A' } });
        fetchConstsMock.mockResolvedValue(undefined);

        const mod = await import('$lib/utils/admin/departments');
        await expect(mod.createDepartment('A')).resolves.toBeUndefined();

        expect(apiMock.post).toHaveBeenCalledWith('/api/v1/departments/', { name: 'A' });
        expect(fetchConstsMock).toHaveBeenCalledWith(true);
    });

    it('Create department successfully (201)', async () => {
        apiMock.post.mockResolvedValue({ success: true, status: 201, data: { id: 2, name: 'B' } });
        fetchConstsMock.mockResolvedValue(undefined);

        const { createDepartment } = await import('$lib/utils/admin/departments');
        await expect(createDepartment('B')).resolves.toBeUndefined();

        expect(apiMock.post).toHaveBeenCalledWith('/api/v1/departments/', { name: 'B' });
        expect(fetchConstsMock).toHaveBeenCalledWith(true);
    });

    it('Create department throws response error', async () => {
        apiMock.post.mockResolvedValue({ success: false, status: 400, error: 'bad' });

        const { createDepartment } = await import('$lib/utils/admin/departments');
        await expect(createDepartment('X')).rejects.toThrow('bad');

        expect(apiMock.post).toHaveBeenCalledWith('/api/v1/departments/', { name: 'X' });
        expect(fetchConstsMock).not.toHaveBeenCalled();
    });

    it('Create department success with unexpected status', async () => {
        apiMock.post.mockResolvedValue({ success: true, status: 204, data: {} });

        const { createDepartment } = await import('$lib/utils/admin/departments');
        await expect(createDepartment('Y')).rejects.toThrow('Ошибка при создании отдела');

        expect(apiMock.post).toHaveBeenCalledWith('/api/v1/departments/', { name: 'Y' });
        expect(fetchConstsMock).not.toHaveBeenCalled();
    });

    it('Update department successfully', async () => {
        apiMock.put.mockResolvedValue({ success: true, status: 200, data: { id: 5, name: 'New' } });
        fetchConstsMock.mockResolvedValue(undefined);

        const { updateDepartment } = await import('$lib/utils/admin/departments');
        await expect(updateDepartment(5, 'New')).resolves.toBeUndefined();

        expect(apiMock.put).toHaveBeenCalledWith('/api/v1/departments/5', { name: 'New' });
        expect(fetchConstsMock).toHaveBeenCalledWith(true);
    });

    it('Update department API returns error', async () => {
        apiMock.put.mockResolvedValue({ success: false, status: 400, error: 'upd fail' });

        const { updateDepartment } = await import('$lib/utils/admin/departments');
        await expect(updateDepartment(7, 'Name')).rejects.toThrow('upd fail');

        expect(apiMock.put).toHaveBeenCalledWith('/api/v1/departments/7', { name: 'Name' });
        expect(fetchConstsMock).not.toHaveBeenCalled();
    });

    it('Update department throws when response status is not 200 or 201', async () => {
        apiMock.put.mockResolvedValue({ success: true, status: 204, data: {} });

        const { updateDepartment } = await import('$lib/utils/admin/departments');
        await expect(updateDepartment(10, 'Name')).rejects.toThrow('Ошибка при обновлении отдела');

        expect(apiMock.put).toHaveBeenCalledWith('/api/v1/departments/10', { name: 'Name' });
        expect(fetchConstsMock).not.toHaveBeenCalled();
    });

    it('Toggle department status successfully', async () => {
        apiMock.post.mockResolvedValue({ success: true, status: 200, data: {} });
        fetchConstsMock.mockResolvedValue(undefined);

        const { toggleDepartmentActive } = await import('$lib/utils/admin/departments');
        await expect(toggleDepartmentActive('9')).resolves.toBeUndefined();

        expect(apiMock.post).toHaveBeenCalledWith('/api/v1/departments/9/toggle_active', {});
        expect(fetchConstsMock).toHaveBeenCalledWith(true);
    });

    it('Toggle department status returns error', async () => {
        apiMock.post.mockResolvedValue({ success: false, status: 500, error: 'toggle error' });

        const { toggleDepartmentActive } = await import('$lib/utils/admin/departments');
        await expect(toggleDepartmentActive(11)).rejects.toThrow('toggle error');

        expect(apiMock.post).toHaveBeenCalledWith('/api/v1/departments/11/toggle_active', {});
        expect(fetchConstsMock).not.toHaveBeenCalled();
    });

    it('Toggle department status throws when response status is not 200 or 201', async () => {
        apiMock.post.mockResolvedValue({ success: true, status: 204, data: {} });

        const { toggleDepartmentActive } = await import('$lib/utils/admin/departments');
        await expect(toggleDepartmentActive(11)).rejects.toThrow('Ошибка при деактивации отдела');

        expect(apiMock.post).toHaveBeenCalledWith('/api/v1/departments/11/toggle_active', {});
        expect(fetchConstsMock).not.toHaveBeenCalled();
    });

    it('All functions propagate fetchConsts rejection', async () => {
        apiMock.post.mockResolvedValue({ success: true, status: 200, data: { id: 1 } });
        apiMock.put.mockResolvedValue({ success: true, status: 200, data: {} });
        fetchConstsMock.mockRejectedValue(new Error('cache fail'));

        const mod = await import('$lib/utils/admin/departments');

        await expect(mod.createDepartment('Z')).rejects.toThrow('cache fail');
        await expect(mod.updateDepartment(2, 'Z')).rejects.toThrow('cache fail');
        await expect(mod.toggleDepartmentActive(3)).rejects.toThrow('cache fail');
    });
});