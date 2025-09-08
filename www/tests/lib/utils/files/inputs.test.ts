import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleFileChange, removeFile } from '$lib/utils/files/inputs';

describe('Handle file change', () => {
    let showModalMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        showModalMock = vi.fn();
    });

    it('Add files within limit', () => {
        const initialFiles: File[] = [];
        const initialFileNames: string[] = [];
        const newFile1 = new File(['content'], 'file1.txt', { type: 'text/plain' });
        const newFile2 = new File(['content'], 'file2.txt', { type: 'text/plain' });
        
        const event = {
            target: {
                files: [newFile1, newFile2]
            }
        } as unknown as Event;

        const result = handleFileChange(event, initialFiles, initialFileNames, showModalMock);
        
        expect(result.files).toHaveLength(2);
        expect(result.fileNames).toEqual(['file1.txt', 'file2.txt']);
        expect(showModalMock).not.toHaveBeenCalled();
    });

    it('Exceed file limit', () => {
        const initialFiles: File[] = [
            new File(['content'], 'file1.txt', { type: 'text/plain' }),
            new File(['content'], 'file2.txt', { type: 'text/plain' }),
            new File(['content'], 'file3.txt', { type: 'text/plain' }),
            new File(['content'], 'file4.txt', { type: 'text/plain' }),
            new File(['content'], 'file5.txt', { type: 'text/plain' })
        ];
        const initialFileNames: string[] = ['file1.txt', 'file2.txt', 'file3.txt', 'file4.txt', 'file5.txt'];
        const newFile = new File(['content'], 'file6.txt', { type: 'text/plain' });
        const event = {
            target: {
                files: [newFile]
            }
        } as unknown as Event;

        const result = handleFileChange(event, initialFiles, initialFileNames, showModalMock);
        
        expect(result.files).toHaveLength(5);
        expect(result.fileNames).toHaveLength(5);
        expect(showModalMock).toHaveBeenCalledWith('Можно прикрепить максимум 5 файлов');
    });

    it('No files selected', () => {
        const initialFiles: File[] = [];
        const initialFileNames: string[] = [];
        const event = {
            target: {
                files: null
            }
        } as unknown as Event;

        const result = handleFileChange(event, initialFiles, initialFileNames, showModalMock);
        
        expect(result.files).toHaveLength(0);
        expect(result.fileNames).toHaveLength(0);
        expect(showModalMock).not.toHaveBeenCalled();
    });

    it('Remove file', () => {
        const initialFiles: File[] = [
            new File(['content'], 'file1.txt', { type: 'text/plain' }),
            new File(['content'], 'file2.txt', { type: 'text/plain' }),
            new File(['content'], 'file3.txt', { type: 'text/plain' })
        ];
        const initialFileNames: string[] = ['file1.txt', 'file2.txt', 'file3.txt'];

        const result = removeFile(1, initialFiles, initialFileNames);
        
        expect(result.files).toHaveLength(2);
        expect(result.fileNames).toEqual(['file1.txt', 'file3.txt']);
    });
});