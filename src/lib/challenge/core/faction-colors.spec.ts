import { describe, expect, it } from 'vitest';
import { FACTION_COLORS, getNextFactionColor, isFactionColor } from './faction-colors';

const LIGHT_SURFACE = '#ffffff';
const DARK_SURFACE = '#172439';
const MIN_CONTRAST = 3;
const MIN_DISTANCE = 30;

function toLinear(channel: number): number {
	const value = channel / 255;
	return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function toRgb(hex: string): [number, number, number] {
	return [1, 3, 5].map((index) => toLinear(parseInt(hex.slice(index, index + 2), 16))) as [
		number,
		number,
		number
	];
}

function getLuminance(hex: string): number {
	const [red, green, blue] = toRgb(hex);
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function getContrast(first: string, second: string): number {
	const [light, dark] = [getLuminance(first), getLuminance(second)].sort((a, b) => b - a);
	return (light + 0.05) / (dark + 0.05);
}

function toLab(hex: string): [number, number, number] {
	const [red, green, blue] = toRgb(hex);
	const x = (0.4124 * red + 0.3576 * green + 0.1805 * blue) / 0.95047;
	const y = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
	const z = (0.0193 * red + 0.1192 * green + 0.9505 * blue) / 1.08883;
	const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
	return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function getDistance(first: string, second: string): number {
	return Math.hypot(...toLab(first).map((value, index) => value - toLab(second)[index]));
}

describe('faction color palette legibility', () => {
	const themes = [
		['light', 'lightHex', LIGHT_SURFACE],
		['dark', 'darkHex', DARK_SURFACE]
	] as const;

	describe.each(themes)('%s theme', (themeName, key, surface) => {
		it.each(FACTION_COLORS)('$value stands out from the background', (color) => {
			expect(
				getContrast(color[key], surface),
				`${color.value} on ${themeName} theme`
			).toBeGreaterThanOrEqual(MIN_CONTRAST);
		});

		it('keeps every pair of colors distinguishable', () => {
			for (const [index, first] of FACTION_COLORS.entries()) {
				for (const second of FACTION_COLORS.slice(index + 1)) {
					expect(
						getDistance(first[key], second[key]),
						`${first.value}/${second.value}`
					).toBeGreaterThanOrEqual(MIN_DISTANCE);
				}
			}
		});
	});

	it('renders a theme-aware CSS color', () => {
		for (const color of FACTION_COLORS) {
			expect(color.hex).toBe(`light-dark(${color.lightHex}, ${color.darkHex})`);
		}
	});
});

describe('faction colors', () => {
	it.each(FACTION_COLORS.map(({ value }) => value))('accepts supported color %s', (value) => {
		expect(isFactionColor(value)).toBe(true);
	});

	it.each(['ultraviolet', '', null, undefined, 1])('rejects unsupported color %s', (value) => {
		expect(isFactionColor(value)).toBe(false);
	});

	it('chooses the first palette color when no factions exist', () => {
		expect(getNextFactionColor([])).toBe('blue');
	});

	it('chooses the first unused color in palette order', () => {
		expect(getNextFactionColor([{ color: 'blue' }, { color: 'red' }])).toBe('green');
	});

	it('reuses the first palette color when all colors are used', () => {
		const factions = FACTION_COLORS.map(({ value }) => ({ color: value }));

		expect(getNextFactionColor(factions)).toBe('blue');
	});
});
