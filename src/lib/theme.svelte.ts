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
 * @param isInitiallyDarkMode Theme applied before app startup; when omitted, it is read from storage.
 * @returns Theme state with a read-only current mode and a toggle operation.
 * @throws {DOMException} If reading the stored theme preference fails.
 */
export function createThemeState(
	storage: ThemeStorage | undefined,
	isInitiallyDarkMode = storage?.getItem(THEME_STORAGE_KEY) === 'dark'
): ThemeState {
	let isDarkMode = $state(isInitiallyDarkMode);

	return {
		get isDarkMode() {
			return isDarkMode;
		},
		toggle() {
			isDarkMode = !isDarkMode;
			if (typeof document !== 'undefined') {
				document.documentElement.classList.toggle('theme-dark', isDarkMode);
			}
			storage?.setItem(THEME_STORAGE_KEY, isDarkMode ? 'dark' : 'light');
		}
	};
}

/** Shared app-wide theme state, initialized from the early document theme on the client. */
export const theme: ThemeState = createThemeState(
	typeof localStorage === 'undefined' ? undefined : localStorage,
	typeof document !== 'undefined' && document.documentElement.classList.contains('theme-dark')
);
