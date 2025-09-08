/* istanbul ignore file */

/**
 * @file Server-side hooks for SvelteKit.
 * This file contains hooks that run on the server side,
 * including error handling and session management.
 */

/** @type {import('@sveltejs/kit').HandleServerError} */
export function handleError({ error }) {
  const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера';
  const code = typeof error === 'object' && error !== null && 'code' in error 
    ? String(error.code) 
    : 'UNKNOWN';
  
  return {
    message,
    code
  };
}