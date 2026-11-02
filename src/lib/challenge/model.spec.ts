import { describe, expect, expectTypeOf, it } from 'vitest';
import {
	CHALLENGE_FORMAT_VERSION,
	DEFAULT_INITIATIVE_ROLL_MODES,
	type ChallengeLibrary,
	type GeneratedTurnOrder,
	type InitiativeResults,
	type StableId,
	type TurnInitiative
} from '#lib';
import { createUuid, parseUuid } from './uuid';

const ids = {
	character: createUuid(),
	challenge: createUuid(),
	faction: createUuid(),
	npcType: createUuid(),
	creature: createUuid(),
	turn: createUuid(),
	secondTurn: createUuid(),
	secondCreature: createUuid(),
	secondTurnId: createUuid()
} satisfies Record<string, StableId>;

const initiativeExamples = [
	{ kind: 'roll' },
	{ kind: 'static', value: 8 },
	{
		kind: 'relative-position',
		relation: 'after',
		distance: 2,
		targetTurnId: ids.turn
	}
] satisfies TurnInitiative[];

const initiativeResults = {
	[ids.turn]: 12
} satisfies InitiativeResults;

const generatedTurnOrder = [ids.turn, ids.secondTurn] satisfies GeneratedTurnOrder;

const library = {
	formatVersion: CHALLENGE_FORMAT_VERSION,
	characters: [
		{
			id: ids.character,
			name: 'Aria'
		}
	],
	challenges: [
		{
			id: ids.challenge,
			name: 'The Old Keep',
			factions: [{ id: ids.faction, name: 'Adventurers' }],
			npcTypes: [{ id: ids.npcType, name: 'Skeleton', initiativeStat: 2 }],
			initiativeRollModes: {
				characters: 'manual',
				npcs: 'app'
			},
			runState: {
				initiativeResults: { [ids.turn]: 12 },
				generatedTurnOrder: [ids.turn, ids.secondTurn]
			},
			creatures: [
				{
					id: ids.creature,
					kind: 'character',
					characterId: ids.character,
					factionId: ids.faction,
					turns: [
						{
							id: ids.turn,
							isHidden: false,
							initiative: { kind: 'roll' }
						},
						{
							id: ids.secondTurn,
							isHidden: true,
							initiative: {
								kind: 'fixed-position',
								from: 'bottom',
								position: 1
							}
						}
					]
				},
				{
					id: ids.secondCreature,
					kind: 'npc',
					creatureTypeId: ids.npcType,
					identifier: 'A',
					factionId: ids.faction,
					turns: [
						{
							id: ids.secondTurnId,
							isHidden: false,
							initiative: null
						}
					]
				}
			]
		}
	]
} satisfies ChallengeLibrary;

describe('challenge domain models', () => {
	it('creates UUID IDs and rejects invalid UUID strings', () => {
		const id = createUuid();

		expectTypeOf<StableId>().toEqualTypeOf<ReturnType<typeof globalThis.crypto.randomUUID>>();
		expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
		expect(parseUuid(id)).toBe(id);
		expect(parseUuid('not-a-uuid')).toBeNull();
	});

	it('uses the initial version for persisted challenge libraries', () => {
		expect(CHALLENGE_FORMAT_VERSION).toBe(1);
		expectTypeOf<ChallengeLibrary['formatVersion']>().toEqualTypeOf<1>();
	});

	it('defaults characters to manual rolls and NPCs to app-calculated rolls', () => {
		expect(DEFAULT_INITIATIVE_ROLL_MODES).toEqual({
			characters: 'manual',
			npcs: 'app'
		});
	});

	it('represents reusable characters, challenge entities, and turn references', () => {
		const challenge = library.challenges[0];

		expect(challenge.creatures[0].kind).toBe('character');
		expect(challenge.creatures[0].turns[1].initiative).toEqual({
			kind: 'fixed-position',
			from: 'bottom',
			position: 1
		});
		expect(library.characters[0].id).toBe(challenge.creatures[0].characterId);
		expect('people' in library).toBe(false);
		expect('groups' in library).toBe(false);
		expect('groupIds' in challenge).toBe(false);
		expect(initiativeResults[ids.turn]).toBe(12);
		expect(generatedTurnOrder).toEqual([ids.turn, ids.secondTurn]);
		expect(challenge.runState.initiativeResults[ids.turn]).toBe(12);
		expect(challenge.runState.generatedTurnOrder).toEqual([ids.turn, ids.secondTurn]);
		expect(initiativeExamples.map(({ kind }) => kind)).toEqual([
			'roll',
			'static',
			'relative-position'
		]);
	});
});
