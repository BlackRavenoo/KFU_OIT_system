/**
 * @file app.d.ts
 * Объявление типов для приложения SvelteKit.
 */

declare global {
	namespace App {
		interface Error {
			message: string;
			code: string;
		}
	}
}

export {};
