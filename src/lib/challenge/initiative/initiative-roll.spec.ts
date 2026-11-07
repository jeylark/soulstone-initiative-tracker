import { describe, expect, it } from 'vitest';
import { rollInitiative } from './initiative-roll';

describe('rollInitiative', () => {
	it.each([
		{ dice: [0.5], expected: 4 },
		{ dice: [0, 0.99], expected: 7 },
		{ dice: [0, 0.5, 0.99], expected: 11 },
		{ dice: [0, 0.2, 0.4, 0.6, 0.99], expected: 13 }
	])('rolls $dice.length d6 and applies the highest-three rule', ({ dice, expected }) => {
		let nextDie = 0;

		expect(rollInitiative(dice.length, () => dice[nextDie++] ?? 0)).toBe(expected);
		expect(nextDie).toBe(dice.length);
	});

	it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.POSITIVE_INFINITY])(
		'rejects invalid dice counts: %s',
		(diceCount) => {
			expect(() => rollInitiative(diceCount, () => 0)).toThrow(RangeError);
		}
	);

	it.each([-0.01, 1, Number.NaN, Number.POSITIVE_INFINITY])(
		'rejects invalid random samples: %s',
		(sample) => {
			expect(() => rollInitiative(1, () => sample)).toThrow(RangeError);
		}
	);
});
