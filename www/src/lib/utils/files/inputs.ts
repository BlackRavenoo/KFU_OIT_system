/**
 * Обработчик изменения прикреплённых к форме файлов.
 * Добавляет выбранные файлы в список, если их количество не превышает 5.
 * @param {Event} event - Событие изменения файла.
 */
export function handleFileChange(
    event: Event,
    files: File[],
    fileNames: string[],
    showModal: (msg: string) => void
): { files: File[], fileNames: string[] } {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
        const newFiles = Array.from(input.files);
        if (files.length + newFiles.length > 5) {
            showModal('Можно прикрепить максимум 5 файлов');
            return { files, fileNames };
        }
        return {
            files: [...files, ...newFiles],
            fileNames: [...fileNames, ...newFiles.map(f => f.name)]
        };
    }
    return { files, fileNames };
}

/**
 * Удаляет файл из списка прикреплённых файлов по индексу.
 * @param {number} index - Индекс файла для удаления.
 */
export function removeFile(
    index: number,
    files: File[],
    fileNames: string[]
): { files: File[], fileNames: string[] } {
    return {
        files: files.filter((_, i) => i !== index),
        fileNames: fileNames.filter((_, i) => i !== index)
    };
}