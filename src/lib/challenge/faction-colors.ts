import type { Faction, FactionColor } from './model';

/** A named faction-color choice and its rendered swatch. */
interface FactionColorOption {
	/** Stable semantic identifier persisted in challenge data. */
	readonly value: FactionColor;
	/** Human-readable color name shown in the selector. */
	readonly label: string;
	/** CSS hex color used to render the swatch. */
	readonly hex: string;
}

/** Palette of supported faction colors in default-selection preference order. */
export const FACTION_COLORS: readonly FactionColorOption[] = [
	{ value: 'blue', label: 'Blue', hex: '#5687c8' },
	{ value: 'red', label: 'Red', hex: '#c76a6e' },
	{ value: 'green', label: 'Green', hex: '#4a906b' },
	{ value: 'amber', label: 'Amber', hex: '#a87930' },
	{ value: 'violet', label: 'Violet', hex: '#9279be' },
	{ value: 'teal', label: 'Teal', hex: '#4a8f91' },
	{ value: 'pink', label: 'Pink', hex: '#b96693' },
	{ value: 'olive', label: 'Olive', hex: '#788842' }
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
