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
		expect(validateChallengeSetup(createChallenge('manual', -1))).toEqual([]);
	});

	it('accepts a zero stat for characters and NPC types', () => {
		const challenge = createChallenge('app', 0);
		challenge.npcTypes[0]!.initiativeStat = 0;

		expect(validateChallengeSetup(challenge)).toEqual([]);
	});

	it('requires a non-negative safe-integer stat for app-mode character turns', () => {
		const issues = validateChallengeSetup(createChallenge('app'));

		expect(issues).toEqual([
			{
				path: `$.creatures[0].initiativeStat`,
				message: 'An initiative stat is required for characters with app-rolled turns.'
			}
		]);
	});

	it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
		'rejects invalid character stats (%s)',
		(initiativeStat) => {
			const issues = validateChallengeSetup(createChallenge('app', initiativeStat));

			expect(issues).toContainEqual({
				path: '$.creatures[0].initiativeStat',
				message: 'Initiative stat must be a non-negative whole number.'
			});
		}
	);

	it('returns multiple issues for independent initiative-stat problems', () => {
		const challenge = createChallenge('app');
		challenge.npcTypes[0]!.initiativeStat = -1;

		expect(validateChallengeSetup(challenge)).toEqual([
			{
				path: '$.npcTypes[0].initiativeStat',
				message: 'Initiative stat must be a non-negative whole number.'
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

		const issues = validateChallengeSetup(challenge);

		expect(issues.map(({ path }) => path)).toEqual([
			'$.name',
			'$.factions[0].name',
			'$.npcTypes[0].name',
			'$.creatures[0].name'
		]);
	});

	describe('blank NPC identifiers', () => {
		function npc(
			identifier: string,
			creatureTypeId: StableId = ids.npcType,
			factionId = ids.faction
		) {
			return {
				id: createUuid(),
				kind: 'npc' as const,
				creatureTypeId,
				identifier,
				factionId,
				isHidden: false,
				turns: []
			};
		}
		const blankIssue = (index: number) => ({
			path: `$.creatures[${index}].identifier`,
			message: 'NPC identifier must not be blank.'
		});

		it.each(['', '   ', '\t'])('allows a sole NPC of its type to be blank (%j)', (identifier) => {
			const challenge = createChallenge();
			challenge.creatures.push(npc(identifier));

			expect(validateChallengeSetup(challenge)).toEqual([]);
		});

		it('rejects a blank identifier alongside a named one of the same type', () => {
			const challenge = createChallenge();
			challenge.creatures.push(npc(' '), npc('A'));

			expect(validateChallengeSetup(challenge)).toEqual([blankIssue(1)]);
		});

		it('rejects every blank identifier when two NPCs of a type are blank', () => {
			const challenge = createChallenge();
			challenge.creatures.push(npc(''), npc('  '));

			expect(validateChallengeSetup(challenge)).toEqual([blankIssue(1), blankIssue(2)]);
		});

		it('allows one blank identifier per distinct type', () => {
			const challenge = createChallenge();
			const otherType = createUuid();
			challenge.npcTypes.push({ id: otherType, name: 'Guard', initiativeStat: 2 });
			challenge.creatures.push(npc(''), npc('', otherType));

			expect(validateChallengeSetup(challenge)).toEqual([]);
		});

		it('counts NPCs of a type across factions', () => {
			const challenge = createChallenge();
			const otherFaction = createUuid();
			challenge.factions.push({ id: otherFaction, name: 'Enemies', color: 'red' });
			challenge.creatures.push(npc(''), npc('A', ids.npcType, otherFaction));

			expect(validateChallengeSetup(challenge)).toEqual([blankIssue(1)]);
		});

		it('revalidates when NPCs are added, removed, or change type', () => {
			const challenge = createChallenge();
			const otherType = createUuid();
			challenge.npcTypes.push({ id: otherType, name: 'Guard', initiativeStat: 2 });
			const blank = npc('');
			const second = npc('B');
			challenge.creatures.push(blank);
			expect(validateChallengeSetup(challenge)).toEqual([]);

			challenge.creatures.push(second);
			expect(validateChallengeSetup(challenge)).toEqual([blankIssue(1)]);

			challenge.creatures.pop();
			expect(validateChallengeSetup(challenge)).toEqual([]);

			challenge.creatures.push(second);
			second.creatureTypeId = otherType;
			expect(validateChallengeSetup(challenge)).toEqual([]);
		});
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
			'$.factions[0].name',
			'$.factions[1].name',
			'$.creatures[0].name',
			'$.npcTypes[0].name',
			'$.creatures[1].identifier',
			'$.creatures[2].identifier'
		]);
	});

	it('rejects invalid finite setup numbers while accepting finite static values', () => {
		const challenge = createChallenge();
		challenge.fairnessWeight = -1;
		challenge.npcTypes[0]!.initiativeStat = -1;
		challenge.creatures[0]!.turns = [
			{ id: ids.turn, initiative: { kind: 'static', value: 1.5 } },
			{ id: createUuid(), initiative: { kind: 'fixed-position', from: 'top', position: 0 } },
			{
				id: createUuid(),
				initiative: {
					kind: 'relative-position',
					relation: 'after',
					index: -1,
					targetTurnId: ids.turn
				}
			}
		];

		const issues = validateChallengeSetup(challenge);

		expect(issues.map(({ path }) => path)).toEqual([
			'$.fairnessWeight',
			'$.npcTypes[0].initiativeStat',
			'$.creatures[0].turns[1].initiative.position',
			'$.creatures[0].turns[2].initiative.index'
		]);
	});

	it('requires contiguous sibling indices only within each target and direction group', () => {
		const challenge = createChallenge();
		const targetTurnId = ids.turn;
		const makeHook = (
			relation: 'before' | 'after',
			index: number | undefined,
			target = targetTurnId
		) => ({
			id: createUuid(),
			initiative: {
				kind: 'relative-position' as const,
				relation,
				...(index === undefined ? {} : { index }),
				targetTurnId: target
			}
		});
		const beforeOne = makeHook('before', 1);
		const beforeTwo = makeHook('before', 2);
		const afterOne = makeHook('after', 1);
		challenge.creatures[0]!.turns.push(beforeOne, beforeTwo, afterOne);

		expect(validateChallengeSetup(challenge)).toEqual([]);
	});

	it('blocks missing, duplicate, and gapped indices for multi-hook groups', () => {
		for (const indices of [
			[undefined, undefined],
			[1, 1],
			[1, 3]
		] as const) {
			const challenge = createChallenge();
			const targetTurnId = ids.turn;
			const hooks = indices.map((index) => ({
				id: createUuid(),
				initiative: {
					kind: 'relative-position' as const,
					relation: 'after' as const,
					...(index === undefined ? {} : { index }),
					targetTurnId
				}
			}));
			challenge.creatures[0]!.turns.push(...hooks);

			const issues = validateChallengeSetup(challenge);

			expect(issues.map(({ path }) => path)).toEqual(
				hooks.map(
					(hook) =>
						`$.creatures[0].turns[${challenge.creatures[0]!.turns.indexOf(hook)}].initiative.index`
				)
			);
		}
	});

	it('allows a singleton to keep an unused index and updates groups after target changes', () => {
		const challenge = createChallenge();
		const targetTurnId = ids.turn;
		const sibling = {
			id: createUuid(),
			initiative: {
				kind: 'relative-position' as const,
				relation: 'after' as const,
				index: 1,
				targetTurnId
			}
		};
		const secondSibling = {
			id: createUuid(),
			initiative: {
				kind: 'relative-position' as const,
				relation: 'after' as const,
				index: 2,
				targetTurnId
			}
		};
		challenge.creatures[0]!.turns.push(sibling, secondSibling);
		const otherTargetId = createUuid();
		challenge.creatures[0]!.turns.push({
			id: otherTargetId,
			initiative: { kind: 'static', value: 1 }
		});
		expect(validateChallengeSetup(challenge)).toEqual([]);

		challenge.creatures[0]!.turns.splice(2, 1);
		expect(validateChallengeSetup(challenge)).toEqual([]);

		challenge.creatures[0]!.turns.push(secondSibling);
		secondSibling.initiative.targetTurnId = otherTargetId;
		expect(validateChallengeSetup(challenge)).toEqual([]);
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
					targetTurnId: secondTurnId
				}
			},
			{
				id: secondTurnId,
				initiative: {
					kind: 'relative-position',
					relation: 'before',
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
