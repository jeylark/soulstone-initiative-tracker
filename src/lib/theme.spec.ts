import { describe, expect, it } from 'vitest';
import { createThemeState, THEME_STORAGE_KEY } from './theme.svelte';

function createMemoryStorage(initial: Readonly<Record<string, string>> = {}) {
	const values = new Map(Object.entries(initial));
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value);
		}
	};
}

describe('theme state', () => {
	it('defaults to light mode when nothing is stored', () => {
		expect(createThemeState(createMemoryStorage()).isDarkMode).toBe(false);
	});

	it('restores a stored dark preference', () => {
		const storage = createMemoryStorage({ [THEME_STORAGE_KEY]: 'dark' });

		expect(createThemeState(storage).isDarkMode).toBe(true);
	});

	it('initializes from a theme already applied to the document', () => {
		expect(createThemeState(undefined, true).isDarkMode).toBe(true);
	});

	it('ignores unrecognized stored values', () => {
		const storage = createMemoryStorage({ [THEME_STORAGE_KEY]: 'blue' });

		expect(createThemeState(storage).isDarkMode).toBe(false);
	});

	it('stores the preference when toggled', () => {
		const storage = createMemoryStorage();
		const theme = createThemeState(storage);

		theme.toggle();

		expect(theme.isDarkMode).toBe(true);
		expect(storage.getItem(THEME_STORAGE_KEY)).toBe('dark');

		theme.toggle();

		expect(theme.isDarkMode).toBe(false);
		expect(storage.getItem(THEME_STORAGE_KEY)).toBe('light');
	});

	it('shares one preference between consumers of the same state', () => {
		const theme = createThemeState(createMemoryStorage());
		const otherConsumer = theme;

		theme.toggle();

		expect(otherConsumer.isDarkMode).toBe(true);
	});

	it('works without storage', () => {
		const theme = createThemeState(undefined);

		theme.toggle();

		expect(theme.isDarkMode).toBe(true);
	});
});
