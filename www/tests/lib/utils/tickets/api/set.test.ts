import { vi } from 'vitest';

if (!globalThis.FormData) {
    globalThis.FormData = class FormData {
        append = vi.fn();
        get = vi.fn();
        getAll = vi.fn();
        has = vi.fn();
        set = vi.fn();
        delete = vi.fn();
        entries = vi.fn().mockReturnValue([]);
        keys = vi.fn().mockReturnValue([]);
        values = vi.fn().mockReturnValue([]);
        forEach = vi.fn();
    } as any;
}

if (!globalThis.Blob) {
    globalThis.Blob = class Blob {
        size: number = 0;
        type: string = '';
        
        constructor(bits: BlobPart[], options?: BlobPropertyBag) {
            this.size = bits.join('').length;
            this.type = options?.type || '';
        }
        
        slice() {
            return new Blob([]);
        }
        
        arrayBuffer() {
            return Promise.resolve(new ArrayBuffer(0));
        }
        
        text() {
            return Promise.resolve('');
        }
        
        stream() {
            return {} as any;
        }
    } as any;
}

globalThis.document = globalThis.document || {
    cookie: '',
    querySelector: vi.fn().mockReturnValue({ scrollIntoView: vi.fn() }),
    querySelectorAll: vi.fn().mockReturnValue([]),
    getElementById: vi.fn(),
    createElement: vi.fn().mockReturnValue({ 
        setAttribute: vi.fn(),
        appendChild: vi.fn()
    }),
    body: { appendChild: vi.fn() },
    location: { href: 'http://localhost:3000/' }
} as any;

globalThis.window = globalThis.window || {
    document: globalThis.document,
    location: { href: 'http://localhost:3000/' },
    scrollTo: vi.fn(),
    localStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn()
    },
    sessionStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn()
    }
} as any;

globalThis.File = globalThis.File || class File {
    name: string;
    size: number;
    type: string;
    content: any;
    
    constructor(bits: any[], name: string, options: any = {}) {
        this.name = name;
        this.size = bits.join('').length;
        this.type = options.type || '';
        this.content = bits;
    }
};

import setupApiMock from '../../../../apiClientMock';

const { apiMock, helpers } = setupApiMock();

import { it, expect, describe, beforeEach } from 'vitest';
import { createTicket, updateTicket, deleteTicket } from '$lib/utils/tickets/api/set';
import { TICKETS_API_ENDPOINTS } from '$lib/utils/tickets/api/endpoints';
import { normalizeDate } from '$lib/utils/tickets/support';

describe('Ticket Set API', () => {
    beforeEach(() => {
        helpers.resetMocks();
    });

    describe('createTicket', () => {
        it('Send create ticket request with correct parameters', async () => {
            const title = 'Test Title';
            const description = 'Test Description';
            const author = 'John Doe';
            const contacts = 'john@example.com';
            const building = 1;
            const cabinet = '101';
            const date = '2023-10-15';
            const department = 1;
            
            helpers.mockSuccess('post', { id: 'new-ticket-id' });
            
            const originalFormData = globalThis.FormData;
            const originalBlob = globalThis.Blob;
            
            const appendMock = vi.fn();
            globalThis.FormData = vi.fn().mockImplementation(() => ({
                append: appendMock
            })) as any;
            
            globalThis.Blob = vi.fn().mockImplementation((content, options) => ({
                content,
                options,
                size: 123,
                type: options?.type || 'application/octet-stream'
            })) as any;
            
            try {
                await createTicket(title, description, author, contacts, building, cabinet, date, department);
                
                expect(apiMock.post).toHaveBeenCalledTimes(1);
                expect(apiMock.post).toHaveBeenCalledWith(
                    TICKETS_API_ENDPOINTS.create,
                    expect.any(Object)
                );
                
                expect(globalThis.FormData).toHaveBeenCalledTimes(1);
                expect(appendMock).toHaveBeenCalledTimes(1);
                expect(appendMock).toHaveBeenCalledWith(
                    'fields',
                    expect.objectContaining({
                        content: [expect.stringContaining(title)],
                        options: expect.objectContaining({ type: 'application/json' })
                    })
                );
                
                const blobCall = (globalThis.Blob as any).mock.calls[0];
                const blobContent = JSON.parse(blobCall[0][0]);
                expect(blobContent).toEqual({
                    title: title,
                    description: description,
                    author: author,
                    author_contacts: contacts,
                    building_id: building,
                    cabinet: cabinet,
                    planned_at: normalizeDate(date),
                    department_id: department
                });
            } finally {
                globalThis.FormData = originalFormData;
                globalThis.Blob = originalBlob;
            }
        });

        it('Send create ticket request without planned date', async () => {
            const title = 'Test Title';
            const description = 'Test Description';
            const author = 'John Doe';
            const contacts = 'john@example.com';
            const building = 1;
            const cabinet = '101';
            const date = '';
            const department = 1;
            
            helpers.mockSuccess('post', { id: 'new-ticket-id' });
            
            const originalFormData = globalThis.FormData;
            const originalBlob = globalThis.Blob;
            
            const appendMock = vi.fn();
            globalThis.FormData = vi.fn().mockImplementation(() => ({
                append: appendMock
            })) as any;
            
            globalThis.Blob = vi.fn().mockImplementation((content, options) => ({
                content,
                options,
                size: 123,
                type: options?.type || 'application/octet-stream'
            })) as any;
            
            try {
                await createTicket(title, description, author, contacts, building, cabinet, date, department);
                
                expect(apiMock.post).toHaveBeenCalledTimes(1);
                expect(apiMock.post).toHaveBeenCalledWith(
                    TICKETS_API_ENDPOINTS.create,
                    expect.any(Object)
                );
                
                expect(globalThis.FormData).toHaveBeenCalledTimes(1);
                expect(appendMock).toHaveBeenCalledTimes(1);
                expect(appendMock).toHaveBeenCalledWith(
                    'fields',
                    expect.objectContaining({
                        content: [expect.stringContaining(title)],
                        options: expect.objectContaining({ type: 'application/json' })
                    })
                );
                
                const blobCall = (globalThis.Blob as any).mock.calls[0];
                const blobContent = JSON.parse(blobCall[0][0]);
                expect(blobContent).toEqual({
                    title: title,
                    description: description,
                    author: author,
                    author_contacts: contacts,
                    building_id: building,
                    cabinet: cabinet,
                    planned_at: normalizeDate(date),
                    department_id: department
                });
            } finally {
                globalThis.FormData = originalFormData;
                globalThis.Blob = originalBlob;
            }
        });
        
        it('Handle files correctly when provided', async () => {
            const title = 'Test Title';
            const description = 'Test Description';
            const author = 'John Doe';
            const contacts = 'john@example.com';
            const building = 1;
            const cabinet = '101';
            const date = '2023-10-15';
            const department = 1;
            const files = [
                new File(['file1 content'], 'file1.txt', { type: 'text/plain' }),
                new File(['file2 content'], 'file2.jpg', { type: 'image/jpeg' })
            ];
            
            helpers.mockSuccess('post', { id: 'new-ticket-id' });
            
            const originalFormData = globalThis.FormData;
            const originalBlob = globalThis.Blob;
            
            const appendMock = vi.fn();
            globalThis.FormData = vi.fn().mockImplementation(() => ({
                append: appendMock
            })) as any;
            
            globalThis.Blob = vi.fn().mockImplementation((content, options) => ({
                content,
                options,
                size: 123,
                type: options?.type || 'application/octet-stream'
            })) as any;
            
            try {
                await createTicket(title, description, author, contacts, building, cabinet, date, department, files);
                
                expect(apiMock.post).toHaveBeenCalledTimes(1);
                expect(appendMock).toHaveBeenCalledTimes(3);
                expect(appendMock).toHaveBeenCalledWith('attachments', files[0]);
                expect(appendMock).toHaveBeenCalledWith('attachments', files[1]);
            } finally {
                globalThis.FormData = originalFormData;
                globalThis.Blob = originalBlob;
            }
        });
        
        it('Throw error when required fields are missing', async () => {
            const title = '';
            const description = 'Test Description';
            const author = 'John Doe';
            const contacts = 'john@example.com';
            const building = 1;
            const cabinet = '101';
            const date = '2023-10-15';
            const department = 1;
            
            await expect(createTicket(title, description, author, contacts, building, cabinet, date, department))
                .rejects
                .toThrow('Все поля обязательны для заполнения');
            
            expect(apiMock.post).not.toHaveBeenCalled();
        });

        it('Throw error when server returns error without text', async () => {
            const title = 'Test Title';
            const description = 'Test Description';
            const author = 'John Doe';
            const contacts = 'john@example.com';
            const building = 1;
            const cabinet = '101';
            const date = '2023-10-15';
            const department = 1;

            helpers.mockError('post', '');

            const originalFormData = globalThis.FormData;
            const originalBlob = globalThis.Blob;

            const appendMock = vi.fn();
                globalThis.FormData = vi.fn().mockImplementation(() => ({
                append: appendMock
            })) as any;

            globalThis.Blob = vi.fn().mockImplementation((content, options) => ({
                content,
                options,
                size: 123,
                type: options?.type || 'application/octet-stream'
            })) as any;

            try {
                await expect(
                    createTicket(title, description, author, contacts, building, cabinet, date, department)
                ).rejects.toThrow('Ошибка создания заявки');
                expect(apiMock.post).toHaveBeenCalledTimes(1);
            } finally {
                globalThis.FormData = originalFormData;
                globalThis.Blob = originalBlob;
            }
        });
    });

    describe('updateTicket', () => {
        it('Send update request with correct parameters', async () => {
            const ticketId = 'test-ticket-id';
            const updateData = {
                title: 'Updated Title',
                description: 'Updated Description',
                priority: 'high',
                planned_at: '2023-11-15T10:00:00Z'
            };
            
            helpers.mockSuccess('put');
            
            await updateTicket(ticketId, updateData);
            
            expect(apiMock.put).toHaveBeenCalledTimes(1);
            expect(apiMock.put).toHaveBeenCalledWith(
                `${TICKETS_API_ENDPOINTS.read}${ticketId}`,
                updateData
            );
        });
        
        it('Filter out empty values', async () => {
            const ticketId = 'test-ticket-id';
            const updateData = {
                title: 'Updated Title',
                description: '',
                priority: 'high',
                planned_at: null
            };
            
            helpers.mockSuccess('put');
            
            await updateTicket(ticketId, updateData);
            
            expect(apiMock.put).toHaveBeenCalledTimes(1);
            expect(apiMock.put).toHaveBeenCalledWith(
                `${TICKETS_API_ENDPOINTS.read}${ticketId}`,
                {
                    title: 'Updated Title',
                    priority: 'high'
                }
            );
        });
        
        it('Send request with empty body when all provided fields are empty (current implementation)', async () => {
            const ticketId = 'test-ticket-id';
            const updateData = {
                title: '',
                description: '',
                priority: '',
                planned_at: null
            };
            
            helpers.mockSuccess('put');
            
            await updateTicket(ticketId, updateData);
            
            expect(apiMock.put).toHaveBeenCalledTimes(1);
            expect(apiMock.put).toHaveBeenCalledWith(
                `${TICKETS_API_ENDPOINTS.read}${ticketId}`,
                {}
            );
        });
        
        it('Throw error on failed update', async () => {
            const ticketId = 'test-ticket-id';
            const updateData = { title: 'Updated Title', priority: 'low' };
            
            helpers.mockError('put', 'Ошибка при обновлении');
            
            await expect(updateTicket(ticketId, updateData))
                .rejects
                .toThrow('Ошибка при обновлении');
            
            expect(apiMock.put).toHaveBeenCalledTimes(1);
        });

        it('Throw error when server returns error without text', async () => {
            const ticketId = 'test-ticket-id';
            const updateData = { title: 'Updated Title', priority: 'low' };
            
            helpers.mockError('put', '');

            try {
                await expect(updateTicket(ticketId, updateData))
                .rejects
                .toThrow('Ошибка обновления заявки');
                expect(apiMock.put).toHaveBeenCalledTimes(1);
            } finally { }
        });

        it('Returns early when data object has exactly one key', async () => {
            const ticketId = 'ticket-123';
            const singleKeyData = { id: 'ticket-123' } as any;

            await expect(updateTicket(ticketId, singleKeyData)).resolves.toBeUndefined();
            expect(apiMock.put).not.toHaveBeenCalled();
        });

        it('Return false when all fields are empty', async () => {
            const api = (await import('$lib/utils/api')).api;
            (api.put as any).mockResolvedValue({ success: true });

            const ticketId = 'test-id';
            const data = {
                id: 123,
                title: 'Test title',
                description: 'Test desc'
            };

            await updateTicket(ticketId, data as any);

            expect(api.put).toHaveBeenCalledWith(
                `${TICKETS_API_ENDPOINTS.read}${ticketId}`,
                expect.not.objectContaining({ id: expect.anything() })
            );
            expect(api.put).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ title: 'Test title', description: 'Test desc' })
            );
        });

        it('Extract id from building object', async () => {
            const api = (await import('$lib/utils/api')).api;
            (api.put as any).mockResolvedValue({ success: true });

            const ticketId = 'test-id';
            const data = {
                title: 'Test title',
                building_id: { id: 42 }
            };

            await updateTicket(ticketId, { ...data } as any);

            expect(api.put).toHaveBeenCalledWith(
                `${TICKETS_API_ENDPOINTS.read}${ticketId}`,
                expect.objectContaining({ building_id: 42 })
            );
        });
    });

    describe('deleteTicket', () => {
        it('Send delete request with correct ID', async () => {
            const ticketId = 'test-ticket-id';
            helpers.mockSuccess('delete');
            
            await deleteTicket(ticketId);
            
            expect(apiMock.delete).toHaveBeenCalledTimes(1);
            expect(apiMock.delete).toHaveBeenCalledWith(
                `${TICKETS_API_ENDPOINTS.delete}${ticketId}`
            );
        });
        
        it('Throw error on failed deletion', async () => {
            const ticketId = 'test-ticket-id';
            helpers.mockError('delete', 'Ошибка при удалении');
            
            await expect(deleteTicket(ticketId))
                .rejects
                .toThrow('Ошибка при удалении');
            
            expect(apiMock.delete).toHaveBeenCalledTimes(1);
        });

        it('Throw error when server returns error without text', async () => {
            const ticketId = 'test-ticket-id';
            
            helpers.mockError('delete', '');

            try {
                await expect(deleteTicket(ticketId))
                .rejects
                .toThrow('Ошибка при удалении заявки');
                expect(apiMock.delete).toHaveBeenCalledTimes(1);
            } finally { }
        });
    });
});