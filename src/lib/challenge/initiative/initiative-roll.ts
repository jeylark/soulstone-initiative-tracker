/**
 * Rolls initiative using one six-sided die per point of initiative stat.
 *
 * @param diceCount Number of d6 to roll; must be a non-negative safe integer.
 * @param random Source of samples in the range [0, 1), defaulting to `Math.random`.
 * @returns 0 when no dice are rolled, the sum of every die when fewer than three are rolled, or the highest three otherwise.
 * @throws {RangeError} If `diceCount` is not a non-negative safe integer or the random source returns a value outside [0, 1).
 */
export function rollInitiative(diceCount: number, random: () => number = Math.random): number {
	if (!Number.isSafeInteger(diceCount) || diceCount < 0) {
		throw new RangeError('Dice count must be a non-negative safe integer.');
	}

	let total = 0;
	const highestDice = [0, 0, 0];
	for (let index = 0; index < diceCount; index += 1) {
		const sample = random();
		if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
			throw new RangeError('Random samples must be finite values in [0, 1).');
		}

		const die = Math.floor(sample * 6) + 1;
		if (diceCount < 3) {
			total += die;
		} else if (die > highestDice[0]) {
			highestDice[2] = highestDice[1];
			highestDice[1] = highestDice[0];
			highestDice[0] = die;
		} else if (die > highestDice[1]) {
			highestDice[2] = highestDice[1];
			highestDice[1] = die;
		} else if (die > highestDice[2]) {
			highestDice[2] = die;
		}
	}

	return diceCount < 3 ? total : highestDice[0] + highestDice[1] + highestDice[2];
}
