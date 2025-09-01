import { goto } from '$app/navigation';
import { browser } from '$app/environment';

/**
 * Перебрасывает пользователя на страницу ошибки с нужным статусом
 * Использует существующий +error.svelte компонент
 * @param status HTTP-статус ошибки (403, 415 и т.д.)
 */
export function navigateToError(status: number): void {
    if (!browser) return;
    
    const errorPath = `/error?status=${status}`;
    
    history.pushState(
        { 
            status,
            __sveltekit_error: true
        }, 
        '', 
        errorPath
    );
    
    goto(errorPath, { replaceState: true });
}