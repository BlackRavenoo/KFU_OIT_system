import type { IAuthStore } from '../types';

export class LocalStorageAuthStore implements IAuthStore {
    get(name: string): string | null {
        return localStorage.getItem(name);
    }

    set(name: string, value: string | null): void {
        value
            ? localStorage.setItem(name, value)
            : localStorage.removeItem(name);
    }

    clear(name: string): void {
        localStorage.removeItem(name);
    }
}