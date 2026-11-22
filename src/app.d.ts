// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Identifier shared by diagnostic records for the current request. */
			correlationId: string;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

declare const APP_VERSION: string;

export {};
