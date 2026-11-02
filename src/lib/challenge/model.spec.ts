import { describe, expect, expectTypeOf, it } from 'vitest';
import {
	CHALLENGE_FORMAT_VERSION,
	DEFAULT_INITIATIVE_ROLL_MODES,
	type ChallengeLibrary,
	type GeneratedTurnOrder,
	type InitiativeResults,
	type StableId,
	type TurnInitiative,
	validateChallengeLibrary
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
	it('accepts a structurally and referentially valid challenge library', () => {
		expect(validateChallengeLibrary(library)).toEqual({ isValid: true, value: library });
	});

	it('reports malformed values and broken references with their paths', () => {
		const invalidLibrary = structuredClone(library);
		invalidLibrary.challenges[0].creatures[0].factionId = createUuid();

		const result = validateChallengeLibrary(invalidLibrary);

		expect(result.isValid).toBe(false);
		if (!result.isValid) {
			expect(result.issues).toContainEqual({
				path: '$.challenges[0].creatures[0].factionId',
				message: 'References a faction that does not exist.'
			});
		}
	});

	it('rejects unsupported library versions and malformed enum values', () => {
		const unsupportedVersion = { ...library, formatVersion: 2 };
		const invalidModes = {
			...library,
			challenges: library.challenges.map((challenge) => ({
				...challenge,
				initiativeRollModes: { ...challenge.initiativeRollModes, npcs: 'automatic' }
			}))
		};

		const versionResult = validateChallengeLibrary(unsupportedVersion);
		const modesResult = validateChallengeLibrary(invalidModes);

		expect(versionResult.isValid).toBe(false);
		if (!versionResult.isValid) {
			expect(versionResult.issues).toContainEqual({
				path: '$.formatVersion',
				message: 'Unsupported challenge library version.'
			});
		}
		expect(modesResult.isValid).toBe(false);
		if (!modesResult.isValid) {
			expect(modesResult.issues).toContainEqual({
				path: '$.challenges[0].initiativeRollModes.npcs',
				message: 'Expected "manual" or "app".'
			});
		}
	});

	it('reports independent shape and reference issues in the same validation pass', () => {
		const invalidLibrary = {
			...library,
			characters: [{ ...library.characters[0], name: 7 }],
			challenges: library.challenges.map((challenge) => ({
				...challenge,
				initiativeRollModes: { ...challenge.initiativeRollModes, npcs: 'automatic' },
				npcTypes: challenge.npcTypes.map((npcType) => ({
					...npcType,
					name: 4,
					initiativeStat: 0
				})),
				creatures: challenge.creatures.map((creature, index) =>
					index === 0 ? { ...creature, factionId: createUuid() } : creature
				)
			}))
		};

		const result = validateChallengeLibrary(invalidLibrary);

		expect(result.isValid).toBe(false);
		if (!result.isValid) {
			expect(result.issues).toHaveLength(5);
			expect(result.issues).toContainEqual({
				path: '$.characters[0].name',
				message: 'Expected a string.'
			});
			expect(result.issues).toContainEqual({
				path: '$.challenges[0].initiativeRollModes.npcs',
				message: 'Expected "manual" or "app".'
			});
			expect(result.issues).toContainEqual({
				path: '$.challenges[0].npcTypes[0].name',
				message: 'Expected a string.'
			});
			expect(result.issues).toContainEqual({
				path: '$.challenges[0].npcTypes[0].initiativeStat',
				message: 'Expected a positive whole number.'
			});
			expect(result.issues).toContainEqual({
				path: '$.challenges[0].creatures[0].factionId',
				message: 'References a faction that does not exist.'
			});
		}
	});

	it('rejects duplicate entity IDs', () => {
		const invalidLibrary = structuredClone(library);
		invalidLibrary.challenges[0].factions[0].id = invalidLibrary.characters[0].id;

		const result = validateChallengeLibrary(invalidLibrary);

		expect(result.isValid).toBe(false);
		if (!result.isValid) {
			expect(result.issues).toContainEqual({
				path: '$.challenges[0].factions[0].id',
				message: 'Duplicate entity UUID.'
			});
		}
	});

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
