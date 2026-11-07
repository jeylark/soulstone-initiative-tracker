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

	it('rejects blank setup names and identifiers', () => {
		const challenge = createChallenge();
		challenge.name = '  ';
		challenge.factions[0]!.name = '\t';
		challenge.npcTypes[0]!.name = '';
		const character = challenge.creatures[0];
		if (character?.kind === 'character') character.name = '  ';
		challenge.creatures.push({
			id: createUuid(),
			kind: 'npc',
			creatureTypeId: ids.npcType,
			identifier: '  ',
			factionId: ids.faction,
			isHidden: false,
			turns: []
		});

		const issues = validateChallengeSetup(challenge);

		expect(issues.map(({ path }) => path)).toEqual([
			'$.name',
			'$.factions[0].name',
			'$.npcTypes[0].name',
			'$.creatures[0].name',
			'$.creatures[1].identifier'
		]);
	});

	it('checks names case-insensitively after trimming within the configured groups', () => {
		const challenge = createChallenge();
		challenge.factions.push({ id: createUuid(), name: ' players ', color: 'red' });
		challenge.npcTypes[0]!.name = ' aria ';
		challenge.creatures.push({
			id: createUuid(),
			kind: 'npc',
			creatureTypeId: ids.npcType,
			identifier: ' A ',
			factionId: ids.faction,
			isHidden: false,
			turns: []
		});
		challenge.creatures.push({
			id: createUuid(),
			kind: 'npc',
			creatureTypeId: ids.npcType,
			identifier: 'a',
			factionId: ids.faction,
			isHidden: false,
			turns: []
		});

		const issues = validateChallengeSetup(challenge);

		expect(issues.map(({ path }) => path)).toEqual([
			'$.factions[1].name',
			'$.npcTypes[0].name',
			'$.creatures[2].identifier'
		]);
	});

	it('rejects invalid finite setup numbers while accepting finite static values', () => {
		const challenge = createChallenge();
		challenge.fairnessWeight = -1;
		challenge.npcTypes[0]!.initiativeStat = 0;
		challenge.creatures[0]!.turns = [
			{ id: ids.turn, initiative: { kind: 'static', value: 1.5 } },
			{ id: createUuid(), initiative: { kind: 'fixed-position', from: 'top', position: 0 } },
			{
				id: createUuid(),
				initiative: {
					kind: 'relative-position',
					relation: 'after',
					distance: -1,
					targetTurnId: ids.turn
				}
			}
		];

		const issues = validateChallengeSetup(challenge);

		expect(issues.map(({ path }) => path)).toEqual([
			'$.fairnessWeight',
			'$.npcTypes[0].initiativeStat',
			'$.creatures[0].turns[1].initiative.position',
			'$.creatures[0].turns[2].initiative.distance'
		]);
	});

	it('blocks relative-placement cycles before rolling', () => {
		const challenge = createChallenge();
		const firstTurnId = createUuid();
		const secondTurnId = createUuid();
		challenge.creatures[0]!.turns = [
			{
				id: firstTurnId,
				initiative: {
					kind: 'relative-position',
					relation: 'before',
					distance: 0,
					targetTurnId: secondTurnId
				}
			},
			{
				id: secondTurnId,
				initiative: {
					kind: 'relative-position',
					relation: 'before',
					distance: 0,
					targetTurnId: firstTurnId
				}
			}
		];

		const issues = validateChallengeSetup(challenge);

		expect(issues).toContainEqual(
			expect.objectContaining({ path: '$.creatures[0].turns[0].initiative' })
		);
		expect(issues).toContainEqual(
			expect.objectContaining({ path: '$.creatures[0].turns[1].initiative' })
		);
	});
});
