// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Challenge, PlayerCharacter } from '#lib';

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			challenge?: Challenge;
			reusableCharacters?: PlayerCharacter[];
		}
		// interface Platform {}
	}
}

export {};
