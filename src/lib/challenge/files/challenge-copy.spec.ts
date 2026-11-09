import { describe, expect, it } from 'vitest';
import type { Challenge, StableId } from '../core/model';
import { createUuid } from '../core/uuid';
import { sanitizeChallenge } from './challenge-copy';

const ids = {
	challenge: createUuid(),
	faction: createUuid(),
	npcType: createUuid(),
	character: createUuid(),
	npc: createUuid(),
	rolledTurn: createUuid(),
	staticTurn: createUuid(),
	fixedTurn: createUuid(),
	relativeTurn: createUuid(),
	npcTurn: createUuid()
} satisfies Record<string, StableId>;

const challenge: Challenge = {
	id: ids.challenge,
	name: 'The Old Keep',
	createdAt: new Date('2025-01-02T03:04:05.000Z'),
	updatedAt: new Date('2025-01-03T03:04:05.000Z'),
	factions: [{ id: ids.faction, name: 'Adventurers', color: 'blue' }],
	npcTypes: [{ id: ids.npcType, name: 'Skeleton', initiativeStat: 2 }],
	fairnessWeight: 3,
	creatures: [
		{
			id: ids.character,
			kind: 'character',
			name: 'Aria',
			initiativeStat: 2,
			factionId: ids.faction,
			isHidden: true,
			turns: [
				{ id: ids.rolledTurn, initiative: { kind: 'roll', mode: 'manual' } },
				{ id: ids.staticTurn, initiative: { kind: 'static', value: 12 } },
				{
					id: ids.fixedTurn,
					initiative: { kind: 'fixed-position', from: 'bottom', position: 1 }
				},
				{
					id: ids.relativeTurn,
					initiative: {
						kind: 'relative-position',
						relation: 'before',
						index: 1,
						targetTurnId: ids.staticTurn
					}
				}
			]
		},
		{
			id: ids.npc,
			kind: 'npc',
			creatureTypeId: ids.npcType,
			identifier: 'A',
			factionId: ids.faction,
			isHidden: false,
			turns: [{ id: ids.npcTurn, initiative: { kind: 'roll', mode: 'app' } }]
		}
	],
	runState: {
		initiativeResults: { [ids.rolledTurn]: 13 },
		tieDecisions: [[ids.rolledTurn, ids.npcTurn]],
		generatedTurnOrder: [
			{ kind: 'turn', turnId: ids.rolledTurn },
			{ kind: 'turn', turnId: ids.npcTurn },
			{ kind: 'spawn' }
		]
	}
};

describe('challenge sanitization', () => {
	it('copies modeled data into independent mutable objects', () => {
		const copy = sanitizeChallenge(challenge);

		expect(copy).toEqual(challenge);
		expect(copy.createdAt).not.toBe(challenge.createdAt);
		expect(copy.updatedAt).not.toBe(challenge.updatedAt);
		expect(copy.factions).not.toBe(challenge.factions);
		expect(copy.npcTypes).not.toBe(challenge.npcTypes);
		expect(copy.creatures).not.toBe(challenge.creatures);
		expect(copy.creatures[0]?.turns).not.toBe(challenge.creatures[0]?.turns);
		expect(copy.creatures[0]?.turns[3]?.initiative).not.toBe(
			challenge.creatures[0]?.turns[3]?.initiative
		);
		expect(copy.runState?.initiativeResults).not.toBe(challenge.runState?.initiativeResults);
		expect(copy.runState?.tieDecisions?.[0]).not.toBe(challenge.runState?.tieDecisions?.[0]);
		expect(copy.runState?.generatedTurnOrder?.[0]).not.toBe(
			challenge.runState?.generatedTurnOrder?.[0]
		);

		copy.createdAt.setTime(0);
		if (copy.creatures[0]?.turns[3]?.initiative.kind === 'relative-position') {
			copy.creatures[0].turns[3].initiative.index = 2;
		}
		if (copy.runState) copy.runState.initiativeResults[ids.rolledTurn] = 20;

		expect(challenge.createdAt.getTime()).toBe(new Date('2025-01-02T03:04:05.000Z').getTime());
		expect(challenge.creatures[0]?.turns[3]?.initiative).toMatchObject({ index: 1 });
		expect(challenge.runState?.initiativeResults[ids.rolledTurn]).toBe(13);
	});

	it('removes fields that are outside the challenge model', () => {
		const challengeWithExtraFields = {
			...challenge,
			privateChallengeField: 'not-for-copy',
			creatures: challenge.creatures.map((creature) => ({
				...creature,
				privateCreatureField: 'not-for-copy'
			}))
		};
		const copy = sanitizeChallenge(challengeWithExtraFields);

		expect(copy).not.toHaveProperty('privateChallengeField');
		expect(copy.creatures[0]).not.toHaveProperty('privateCreatureField');
	});

	it('preserves the absence of optional run state', () => {
		const challengeWithoutRunState = { ...challenge };
		delete challengeWithoutRunState.runState;

		expect(sanitizeChallenge(challengeWithoutRunState)).not.toHaveProperty('runState');
	});
});

describe('Spawn editing state copying', () => {
	const editingChallenge: Challenge = {
		...challenge,
		runState: {
			initiativeResults: { [ids.rolledTurn]: 13 },
			generatedTurnOrder: [{ kind: 'spawn' }],
			spawnEdit: {
				newCreatureIds: [ids.npc],
				newNpcTypeIds: [ids.npcType],
				newTurnIds: [ids.npcTurn],
				lockedInitiativeTurnIds: [ids.rolledTurn]
			}
		}
	};

	it('copies all editing arrays independently', () => {
		const copy = sanitizeChallenge(editingChallenge);
		const source = editingChallenge.runState?.spawnEdit;

		expect(copy.runState?.spawnEdit).toEqual(source);
		for (const key of [
			'newCreatureIds',
			'newNpcTypeIds',
			'newTurnIds',
			'lockedInitiativeTurnIds'
		] as const) {
			expect(copy.runState?.spawnEdit?.[key]).not.toBe(source?.[key]);
		}
		copy.runState?.spawnEdit?.newTurnIds.push(ids.fixedTurn);
		expect(source?.newTurnIds).toEqual([ids.npcTurn]);
	});

	it('omits editing state when absent', () => {
		expect(sanitizeChallenge(challenge).runState).not.toHaveProperty('spawnEdit');
	});
});
