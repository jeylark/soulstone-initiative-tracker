import { describe, expect, it } from 'vitest';
import { FACTION_COLORS, getNextFactionColor, isFactionColor } from './faction-colors';

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
