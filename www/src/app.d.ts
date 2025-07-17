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

	interface LoginRequest {
		email: string;
		password: string;
		fingerprint: string;
	}
	
	interface AuthTokens {
		accessToken: string;
		refreshToken?: string;
	}
	
	export interface UserData {
		id: string;
		name: string;
		email: string;
		role: number;
	}
}

export {};
