/** Local-storage key used to persist the app-wide light or dark theme choice. */
export const THEME_STORAGE_KEY = 'soulstone-theme';

type ThemeStorage = Readonly<Pick<Storage, 'getItem' | 'setItem'>>;

/** Current app theme state and its user-facing control. */
interface ThemeState {
	/** Whether dark mode is currently active. */
	readonly isDarkMode: boolean;
	/** Toggles the active theme and persists the new choice when storage is available.
	 * @throws {DOMException} If writing the new theme preference to storage fails.
	 */
	toggle(): void;
}

/**
 * Creates theme state initialized from the persisted preference.
 * @param storage Storage adapter used to read and persist the theme; omit it when storage is unavailable.
 * @returns Theme state with a read-only current mode and a toggle operation.
 * @throws {DOMException} If reading the stored theme preference fails.
 */
export function createThemeState(storage: ThemeStorage | undefined): ThemeState {
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

/** Shared app-wide theme state; server rendering uses the default light theme. */
export const theme: ThemeState = createThemeState(
	typeof localStorage === 'undefined' ? undefined : localStorage
);
