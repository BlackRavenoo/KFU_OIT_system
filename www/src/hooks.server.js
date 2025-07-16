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