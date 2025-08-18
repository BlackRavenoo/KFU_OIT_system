import type { IAuthStore } from '../types';

export class LocalStorageAuthStore implements IAuthStore {
    /**
     * Проверяет доступность localStorage
     * @returns {boolean} true, если localStorage доступен, иначе false
     */
    private isStorageAvailable(): boolean {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, testKey);
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    }

    get(name: string): string | null {
        if (!this.isStorageAvailable()) return null;

        try {
            return localStorage.getItem(name);
        } catch (e) {
            console.warn(`Ошибка при получении данных из localStorage (${name}):`, e);
            return null;
        }
    }

    set(name: string, value: string | null): void {
        if (!this.isStorageAvailable()) return;

        try {
            value
                ? localStorage.setItem(name, value)
                : localStorage.removeItem(name);
        } catch (e) {
            console.warn(`Ошибка при сохранении данных в localStorage (${name}):`, e);
        }
    }

    clear(name: string): void {
        if (!this.isStorageAvailable()) return;

        try {
            localStorage.removeItem(name);
        } catch (e) {
            console.warn(`Ошибка при удалении данных из localStorage (${name}):`, e);
        }
    }
}