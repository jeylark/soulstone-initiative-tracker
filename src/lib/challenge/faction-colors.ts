import type { Faction, FactionColor } from './model';

/** Named faction-color options and their stable swatch values. */
export const FACTION_COLORS = [
	{ value: 'blue', label: 'Blue', hex: '#5687c8' },
	{ value: 'red', label: 'Red', hex: '#c76a6e' },
	{ value: 'green', label: 'Green', hex: '#4a906b' },
	{ value: 'amber', label: 'Amber', hex: '#a87930' },
	{ value: 'violet', label: 'Violet', hex: '#9279be' },
	{ value: 'teal', label: 'Teal', hex: '#4a8f91' },
	{ value: 'pink', label: 'Pink', hex: '#b96693' },
	{ value: 'olive', label: 'Olive', hex: '#788842' }
] as const satisfies readonly Readonly<{
	value: FactionColor;
	label: string;
	hex: string;
}>[];

/** Checks whether an unknown value is a supported faction color. */
export function isFactionColor(value: unknown): value is FactionColor {
	return FACTION_COLORS.some((color) => color.value === value);
}

/** Chooses the first unused palette color, reusing the first option when all are taken. */
export function getNextFactionColor(
	factions: readonly Readonly<Pick<Faction, 'color'>>[]
): FactionColor {
	const usedColors = new Set(factions.map(({ color }) => color));
	return FACTION_COLORS.find(({ value }) => !usedColors.has(value))?.value ?? 'blue';
}
