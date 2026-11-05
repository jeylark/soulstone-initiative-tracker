import { describe, expect, it } from 'vitest';
import type { Challenge, PlayerCharacter, StableId } from './model';
import { createUuid } from './uuid';
import { validateChallengeSetup } from './setup-validation';

const ids = {
	challenge: createUuid(),
	faction: createUuid(),
	character: createUuid(),
	creature: createUuid(),
	turn: createUuid(),
	npcType: createUuid()
} satisfies Record<string, StableId>;

function createChallenge(mode: 'app' | 'manual' = 'manual'): Challenge {
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
				characterId: ids.character,
				factionId: ids.faction,
				isHidden: false,
				turns: [{ id: ids.turn, initiative: { kind: 'roll', mode } }]
			}
		]
	};
}

const character: PlayerCharacter = { id: ids.character, name: 'Aria' };

describe('validateChallengeSetup', () => {
	it('allows a character without a stat when its turns are manual', () => {
		expect(validateChallengeSetup(createChallenge(), [character])).toEqual([]);
	});

	it('requires a positive safe-integer stat for app-mode character turns', () => {
		const issues = validateChallengeSetup(createChallenge('app'), [character]);

		expect(issues).toEqual([
			{
				path: `$.characters[0].initiativeStat`,
				message: 'An initiative stat is required for characters with app-rolled turns.'
			}
		]);
	});

	it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
		'rejects invalid character stats (%s)',
		(initiativeStat) => {
			const issues = validateChallengeSetup(createChallenge('app'), [
				{ ...character, initiativeStat }
			]);

			expect(issues).toContainEqual({
				path: '$.characters[0].initiativeStat',
				message: 'Initiative stat must be a positive whole number.'
			});
		}
	);

	it('returns multiple issues for independent initiative-stat problems', () => {
		const challenge = createChallenge('app');
		challenge.npcTypes[0]!.initiativeStat = 0;

		expect(validateChallengeSetup(challenge, [character])).toEqual([
			{
				path: '$.npcTypes[0].initiativeStat',
				message: 'Initiative stat must be a positive whole number.'
			},
			{
				path: '$.characters[0].initiativeStat',
				message: 'An initiative stat is required for characters with app-rolled turns.'
			}
		]);
	});
});
