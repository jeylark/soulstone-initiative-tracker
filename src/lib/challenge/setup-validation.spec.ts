import { describe, expect, it } from 'vitest';
import type { Challenge, StableId } from './model';
import { createUuid } from './uuid';
import { validateChallengeSetup } from './setup-validation';

const ids = {
	challenge: createUuid(),
	faction: createUuid(),
	creature: createUuid(),
	turn: createUuid(),
	npcType: createUuid()
} satisfies Record<string, StableId>;

function createChallenge(mode: 'app' | 'manual' = 'manual', initiativeStat?: number): Challenge {
	return {
		id: ids.challenge,
		name: 'Setup validation',
		createdAt: new Date('2026-01-01T00:00:00.000Z'),
		updatedAt: new Date('2026-01-01T00:00:00.000Z'),
		factions: [{ id: ids.faction, name: 'Players', color: 'blue' }],
		npcTypes: [{ id: ids.npcType, name: 'Sentinel', initiativeStat: 2 }],
		fairnessWeight: 3,
		creatures: [
			{
				id: ids.creature,
				kind: 'character',
				name: 'Aria',
				...(initiativeStat === undefined ? {} : { initiativeStat }),
				factionId: ids.faction,
				isHidden: false,
				turns: [{ id: ids.turn, initiative: { kind: 'roll', mode } }]
			}
		]
	};
}

describe('validateChallengeSetup', () => {
	it('allows a character without a stat when its turns are manual', () => {
		expect(validateChallengeSetup(createChallenge())).toEqual([]);
	});

	it('ignores a hidden invalid stat when no turn is app-rolled', () => {
		expect(validateChallengeSetup(createChallenge('manual', 0))).toEqual([]);
	});

	it('requires a positive safe-integer stat for app-mode character turns', () => {
		const issues = validateChallengeSetup(createChallenge('app'));

		expect(issues).toEqual([
			{
				path: `$.creatures[0].initiativeStat`,
				message: 'An initiative stat is required for characters with app-rolled turns.'
			}
		]);
	});

	it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
		'rejects invalid character stats (%s)',
		(initiativeStat) => {
			const issues = validateChallengeSetup(createChallenge('app', initiativeStat));

			expect(issues).toContainEqual({
				path: '$.creatures[0].initiativeStat',
				message: 'Initiative stat must be a positive whole number.'
			});
		}
	);

	it('returns multiple issues for independent initiative-stat problems', () => {
		const challenge = createChallenge('app');
		challenge.npcTypes[0]!.initiativeStat = 0;

		expect(validateChallengeSetup(challenge)).toEqual([
			{
				path: '$.npcTypes[0].initiativeStat',
				message: 'Initiative stat must be a positive whole number.'
			},
			{
				path: '$.creatures[0].initiativeStat',
				message: 'An initiative stat is required for characters with app-rolled turns.'
			}
		]);
	});
});
