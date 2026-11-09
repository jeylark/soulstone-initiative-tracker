import type { Faction, FactionColor } from './model';

/** A named faction-color choice and its rendered swatch. */
interface FactionColorOption {
	/** Stable semantic identifier persisted in challenge data. */
	readonly value: FactionColor;
	/** Human-readable color name shown in the selector. */
	readonly label: string;
	/** Hex color tuned for the light theme's surface. */
	readonly lightHex: string;
	/** Hex color tuned for the dark theme's surface. */
	readonly darkHex: string;
	/** CSS `light-dark()` color that follows the active theme's `color-scheme`. */
	readonly hex: string;
}

/**
 * Builds a palette option whose CSS color switches with the active theme.
 * @param value Stable semantic identifier.
 * @param label Human-readable name.
 * @param lightHex Hex color for the light theme.
 * @param darkHex Hex color for the dark theme.
 * @returns The complete palette option.
 */
function color(
	value: FactionColor,
	label: string,
	lightHex: string,
	darkHex: string
): FactionColorOption {
	return { value, label, lightHex, darkHex, hex: `light-dark(${lightHex}, ${darkHex})` };
}

/** Palette of supported faction colors in default-selection preference order. */
export const FACTION_COLORS: readonly FactionColorOption[] = [
	color('blue', 'Blue', '#1f5fbf', '#5c9dff'),
	color('red', 'Red', '#d32f2f', '#ff6b6b'),
	color('green', 'Green', '#2e8b3e', '#4fd16a'),
	color('amber', 'Amber', '#c77300', '#ffb020'),
	color('violet', 'Violet', '#7b3fc4', '#b085ff'),
	color('teal', 'Teal', '#00899a', '#26d0e0'),
	color('pink', 'Pink', '#d6247f', '#ff6eb4'),
	color('olive', 'Olive', '#7d7d00', '#c5c53a')
];

/**
 * Checks whether a value is a supported faction color.
 * @param value Candidate value to check.
 * @returns `true` when the value is a member of the faction palette.
 */
export function isFactionColor(value: unknown): value is FactionColor {
	return FACTION_COLORS.some((color) => color.value === value);
}

/**
 * Chooses the first unused palette color, reusing the first option when all are taken.
 * @param factions Factions whose selected colors should be treated as already used.
 * @returns The preferred unused color, or the first palette color when all are used.
 */
export function getNextFactionColor(
	factions: readonly Readonly<Pick<Faction, 'color'>>[]
): FactionColor {
	const usedColors = new Set(factions.map(({ color }) => color));
	return FACTION_COLORS.find(({ value }) => !usedColors.has(value))?.value ?? 'blue';
}
