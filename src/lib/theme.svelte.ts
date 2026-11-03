export const THEME_STORAGE_KEY = 'soulstone-theme';

type ThemeStorage = Readonly<Pick<Storage, 'getItem' | 'setItem'>>;

export function createThemeState(storage: ThemeStorage | undefined) {
	let isDarkMode = $state(storage?.getItem(THEME_STORAGE_KEY) === 'dark');

	return {
		get isDarkMode() {
			return isDarkMode;
		},
		toggle() {
			isDarkMode = !isDarkMode;
			storage?.setItem(THEME_STORAGE_KEY, isDarkMode ? 'dark' : 'light');
		}
	};
}

// Shared app-wide; undefined during server rendering, where no preference is available.
export const theme = createThemeState(
	typeof localStorage === 'undefined' ? undefined : localStorage
);
