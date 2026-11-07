import { describe, expect, expectTypeOf, it } from 'vitest';
import {
	CHALLENGE_FORMAT_VERSION,
	type ChallengeLibrary,
	type GeneratedTurnOrder,
	type InitiativeResults,
	type StableId,
	type TurnInitiative,
	validateChallengeLibrary
} from '#lib/challenge';
import { createUuid, parseUuid } from './uuid';

const ids = {
	challenge: createUuid(),
	faction: createUuid(),
	npcType: createUuid(),
	creature: createUuid(),
	turn: createUuid(),
	secondTurn: createUuid(),
	secondCreature: createUuid(),
	secondTurnId: createUuid()
} satisfies Record<string, StableId>;

const initiativeResults = {
	[ids.turn]: 12
} satisfies InitiativeResults;

const generatedTurnOrder = [
	{ kind: 'turn', turnId: ids.turn },
	{ kind: 'turn', turnId: ids.secondTurn },
	{ kind: 'spawn' }
] satisfies GeneratedTurnOrder;

const initiativeExamples = [
	{ kind: 'roll', mode: 'app' },
	{ kind: 'roll', mode: 'manual' },
	{ kind: 'static', value: 8 },
	{ kind: 'fixed-position', from: 'top', position: 2 },
	{ kind: 'fixed-position', from: 'bottom', position: 1 },
	{
		kind: 'relative-position',
		relation: 'before',
		distance: 0,
		targetTurnId: ids.secondTurn
	},
	{
		kind: 'relative-position',
		relation: 'after',
		distance: 2,
		targetTurnId: ids.secondTurn
	}
] satisfies TurnInitiative[];

const library = {
	formatVersion: CHALLENGE_FORMAT_VERSION,
	challenges: [
		{
			id: ids.challenge,
			name: 'The Old Keep',
			createdAt: new Date('2025-01-02T03:04:05.000Z'),
			updatedAt: new Date('2025-01-02T03:04:05.000Z'),
			factions: [{ id: ids.faction, name: 'Adventurers', color: 'blue' }],
			npcTypes: [{ id: ids.npcType, name: 'Skeleton', initiativeStat: 2 }],
			fairnessWeight: 3,
			runState: {
				initiativeResults: { [ids.turn]: 12, [ids.secondTurnId]: 8 },
				generatedTurnOrder: [
					{ kind: 'turn', turnId: ids.turn },
					{ kind: 'turn', turnId: ids.secondTurn },
					{ kind: 'turn', turnId: ids.secondTurnId },
					{ kind: 'spawn' }
				]
			},
			creatures: [
				{
					id: ids.creature,
					kind: 'character',
					name: 'Aria',
					factionId: ids.faction,
					isHidden: true,
					turns: [
						{
							id: ids.turn,
							initiative: { kind: 'roll', mode: 'manual' }
						},
						{
							id: ids.secondTurn,
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
					isHidden: false,
					turns: [
						{
							id: ids.secondTurnId,
							initiative: { kind: 'roll', mode: 'app' }
						}
					]
				}
			]
		}
	]
} satisfies ChallengeLibrary;

function replaceAtPath(
	value: unknown,
	path: readonly (string | number)[],
	replacement: unknown
): unknown {
	const [key, ...remainingPath] = path;
	if (key === undefined) return replacement;

	if (Array.isArray(value)) {
		if (typeof key !== 'number' || key < 0 || key >= value.length) {
			throw new Error('Invalid array path in validation test.');
		}
		const updated = [...value];
		updated[key] = replaceAtPath(updated[key], remainingPath, replacement);
		return updated;
	}

	if (typeof value !== 'object' || value === null) {
		throw new Error('Invalid object path in validation test.');
	}

	const property = String(key);
	return {
		...value,
		[property]: replaceAtPath(
			(value as Record<string, unknown>)[property],
			remainingPath,
			replacement
		)
	};
}

const invalidFieldCases = [
	{
		field: 'formatVersion',
		path: ['formatVersion'],
		value: 2,
		issuePath: '$.formatVersion',
		message: 'Unsupported challenge library version.'
	},
	{
		field: 'challenges collection',
		path: ['challenges'],
		value: null,
		issuePath: '$.challenges',
		message: 'Expected an array.'
	},
	{
		field: 'challenge object',
		path: ['challenges', 0],
		value: null,
		issuePath: '$.challenges[0]',
		message: 'Expected a challenge object.'
	},
	{
		field: 'challenge id',
		path: ['challenges', 0, 'id'],
		value: 'invalid',
		issuePath: '$.challenges[0].id',
		message: 'Expected a valid UUID.'
	},
	{
		field: 'challenge name',
		path: ['challenges', 0, 'name'],
		value: 4,
		issuePath: '$.challenges[0].name',
		message: 'Expected a string.'
	},
	{
		field: 'factions collection',
		path: ['challenges', 0, 'factions'],
		value: null,
		issuePath: '$.challenges[0].factions',
		message: 'Expected an array.'
	},
	{
		field: 'faction object',
		path: ['challenges', 0, 'factions', 0],
		value: null,
		issuePath: '$.challenges[0].factions[0]',
		message: 'Expected a faction object.'
	},
	{
		field: 'faction id',
		path: ['challenges', 0, 'factions', 0, 'id'],
		value: 'invalid',
		issuePath: '$.challenges[0].factions[0].id',
		message: 'Expected a valid UUID.'
	},
	{
		field: 'faction name',
		path: ['challenges', 0, 'factions', 0, 'name'],
		value: 4,
		issuePath: '$.challenges[0].factions[0].name',
		message: 'Expected a string.'
	},
	{
		field: 'faction color',
		path: ['challenges', 0, 'factions', 0, 'color'],
		value: 'ultraviolet',
		issuePath: '$.challenges[0].factions[0].color',
		message: 'Expected a supported faction color.'
	},
	{
		field: 'NPC types collection',
		path: ['challenges', 0, 'npcTypes'],
		value: null,
		issuePath: '$.challenges[0].npcTypes',
		message: 'Expected an array.'
	},
	{
		field: 'NPC type object',
		path: ['challenges', 0, 'npcTypes', 0],
		value: null,
		issuePath: '$.challenges[0].npcTypes[0]',
		message: 'Expected an NPC type object.'
	},
	{
		field: 'NPC type id',
		path: ['challenges', 0, 'npcTypes', 0, 'id'],
		value: 'invalid',
		issuePath: '$.challenges[0].npcTypes[0].id',
		message: 'Expected a valid UUID.'
	},
	{
		field: 'NPC type name',
		path: ['challenges', 0, 'npcTypes', 0, 'name'],
		value: 4,
		issuePath: '$.challenges[0].npcTypes[0].name',
		message: 'Expected a string.'
	},
	{
		field: 'NPC initiative stat',
		path: ['challenges', 0, 'npcTypes', 0, 'initiativeStat'],
		value: Infinity,
		issuePath: '$.challenges[0].npcTypes[0].initiativeStat',
		message: 'Expected a finite number.'
	},
	{
		field: 'fairness weight',
		path: ['challenges', 0, 'fairnessWeight'],
		value: '3',
		issuePath: '$.challenges[0].fairnessWeight',
		message: 'Expected a finite number.'
	},
	{
		field: 'non-finite fairness weight',
		path: ['challenges', 0, 'fairnessWeight'],
		value: Infinity,
		issuePath: '$.challenges[0].fairnessWeight',
		message: 'Expected a finite number.'
	},
	{
		field: 'creatures collection',
		path: ['challenges', 0, 'creatures'],
		value: null,
		issuePath: '$.challenges[0].creatures',
		message: 'Expected an array.'
	},
	{
		field: 'creature object',
		path: ['challenges', 0, 'creatures', 0],
		value: null,
		issuePath: '$.challenges[0].creatures[0]',
		message: 'Expected a creature object.'
	},
	{
		field: 'creature kind',
		path: ['challenges', 0, 'creatures', 0, 'kind'],
		value: 'beast',
		issuePath: '$.challenges[0].creatures[0].kind',
		message: 'Expected "character" or "npc".'
	},
	{
		field: 'character creature id',
		path: ['challenges', 0, 'creatures', 0, 'id'],
		value: 'invalid',
		issuePath: '$.challenges[0].creatures[0].id',
		message: 'Expected a valid UUID.'
	},
	{
		field: 'character creature name',
		path: ['challenges', 0, 'creatures', 0, 'name'],
		value: 4,
		issuePath: '$.challenges[0].creatures[0].name',
		message: 'Expected a string.'
	},
	{
		field: 'character creature faction id',
		path: ['challenges', 0, 'creatures', 0, 'factionId'],
		value: 'invalid',
		issuePath: '$.challenges[0].creatures[0].factionId',
		message: 'Expected a valid UUID.'
	},
	{
		field: 'character creature visibility',
		path: ['challenges', 0, 'creatures', 0, 'isHidden'],
		value: 'no',
		issuePath: '$.challenges[0].creatures[0].isHidden',
		message: 'Expected a boolean.'
	},
	{
		field: 'NPC creature visibility',
		path: ['challenges', 0, 'creatures', 1, 'isHidden'],
		value: 'no',
		issuePath: '$.challenges[0].creatures[1].isHidden',
		message: 'Expected a boolean.'
	},
	{
		field: 'character creature turns',
		path: ['challenges', 0, 'creatures', 0, 'turns'],
		value: null,
		issuePath: '$.challenges[0].creatures[0].turns',
		message: 'Expected an array.'
	},
	{
		field: 'turn object',
		path: ['challenges', 0, 'creatures', 0, 'turns', 0],
		value: null,
		issuePath: '$.challenges[0].creatures[0].turns[0]',
		message: 'Expected a turn object.'
	},
	{
		field: 'turn id',
		path: ['challenges', 0, 'creatures', 0, 'turns', 0, 'id'],
		value: 'invalid',
		issuePath: '$.challenges[0].creatures[0].turns[0].id',
		message: 'Expected a valid UUID.'
	},
	{
		field: 'turn initiative',
		path: ['challenges', 0, 'creatures', 0, 'turns', 0, 'initiative'],
		value: undefined,
		issuePath: '$.challenges[0].creatures[0].turns[0].initiative',
		message: 'Expected an initiative object.'
	},
	{
		field: 'null turn initiative',
		path: ['challenges', 0, 'creatures', 0, 'turns', 0, 'initiative'],
		value: null,
		issuePath: '$.challenges[0].creatures[0].turns[0].initiative',
		message: 'Expected an initiative object.'
	},
	{
		field: 'initiative kind',
		path: ['challenges', 0, 'creatures', 0, 'turns', 0, 'initiative', 'kind'],
		value: 'random',
		issuePath: '$.challenges[0].creatures[0].turns[0].initiative.kind',
		message: 'Expected a supported initiative kind.'
	},
	{
		field: 'initiative roll mode',
		path: ['challenges', 0, 'creatures', 0, 'turns', 0, 'initiative'],
		value: { kind: 'roll', mode: 'automatic' },
		issuePath: '$.challenges[0].creatures[0].turns[0].initiative.mode',
		message: 'Expected "app" or "manual".'
	},
	{
		field: 'missing initiative roll mode',
		path: ['challenges', 0, 'creatures', 0, 'turns', 0, 'initiative'],
		value: { kind: 'roll' },
		issuePath: '$.challenges[0].creatures[0].turns[0].initiative.mode',
		message: 'Expected "app" or "manual".'
	},
	{
		field: 'static initiative value',
		path: ['challenges', 0, 'creatures', 0, 'turns', 0, 'initiative'],
		value: { kind: 'static', value: Number.NaN },
		issuePath: '$.challenges[0].creatures[0].turns[0].initiative.value',
		message: 'Expected a finite initiative value.'
	},
	{
		field: 'fixed initiative position origin',
		path: ['challenges', 0, 'creatures', 0, 'turns', 1, 'initiative'],
		value: { kind: 'fixed-position', from: 'middle', position: 1 },
		issuePath: '$.challenges[0].creatures[0].turns[1].initiative.from',
		message: 'Expected "top" or "bottom".'
	},
	{
		field: 'non-finite fixed initiative position',
		path: ['challenges', 0, 'creatures', 0, 'turns', 1, 'initiative'],
		value: { kind: 'fixed-position', from: 'bottom', position: Infinity },
		issuePath: '$.challenges[0].creatures[0].turns[1].initiative.position',
		message: 'Expected a finite number.'
	},
	{
		field: 'relative initiative relation',
		path: ['challenges', 0, 'creatures', 0, 'turns', 0, 'initiative'],
		value: {
			kind: 'relative-position',
			relation: 'alongside',
			distance: 1,
			targetTurnId: ids.secondTurn
		},
		issuePath: '$.challenges[0].creatures[0].turns[0].initiative.relation',
		message: 'Expected "before" or "after".'
	},
	{
		field: 'non-finite relative initiative distance',
		path: ['challenges', 0, 'creatures', 0, 'turns', 0, 'initiative'],
		value: {
			kind: 'relative-position',
			relation: 'after',
			distance: Infinity,
			targetTurnId: ids.secondTurn
		},
		issuePath: '$.challenges[0].creatures[0].turns[0].initiative.distance',
		message: 'Expected a finite number.'
	},
	{
		field: 'relative initiative target id',
		path: ['challenges', 0, 'creatures', 0, 'turns', 0, 'initiative'],
		value: {
			kind: 'relative-position',
			relation: 'after',
			distance: 1,
			targetTurnId: 'invalid'
		},
		issuePath: '$.challenges[0].creatures[0].turns[0].initiative.targetTurnId',
		message: 'Expected a valid UUID.'
	},
	{
		field: 'NPC creature id',
		path: ['challenges', 0, 'creatures', 1, 'id'],
		value: 'invalid',
		issuePath: '$.challenges[0].creatures[1].id',
		message: 'Expected a valid UUID.'
	},
	{
		field: 'NPC creature type id',
		path: ['challenges', 0, 'creatures', 1, 'creatureTypeId'],
		value: 'invalid',
		issuePath: '$.challenges[0].creatures[1].creatureTypeId',
		message: 'Expected a valid UUID.'
	},
	{
		field: 'NPC creature identifier',
		path: ['challenges', 0, 'creatures', 1, 'identifier'],
		value: 4,
		issuePath: '$.challenges[0].creatures[1].identifier',
		message: 'Expected a string.'
	},
	{
		field: 'NPC creature faction id',
		path: ['challenges', 0, 'creatures', 1, 'factionId'],
		value: 'invalid',
		issuePath: '$.challenges[0].creatures[1].factionId',
		message: 'Expected a valid UUID.'
	},
	{
		field: 'NPC creature turns',
		path: ['challenges', 0, 'creatures', 1, 'turns'],
		value: null,
		issuePath: '$.challenges[0].creatures[1].turns',
		message: 'Expected an array.'
	},
	{
		field: 'run state object',
		path: ['challenges', 0, 'runState'],
		value: null,
		issuePath: '$.challenges[0].runState',
		message: 'Expected a run state object.'
	},
	{
		field: 'initiative results object',
		path: ['challenges', 0, 'runState', 'initiativeResults'],
		value: null,
		issuePath: '$.challenges[0].runState.initiativeResults',
		message: 'Expected an object keyed by turn UUID.'
	},
	{
		field: 'initiative results turn id',
		path: ['challenges', 0, 'runState', 'initiativeResults'],
		value: { invalid: 12 },
		issuePath: '$.challenges[0].runState.initiativeResults.invalid',
		message: 'Expected a valid turn UUID key.'
	},
	{
		field: 'initiative results value',
		path: ['challenges', 0, 'runState', 'initiativeResults', ids.turn],
		value: 'fast',
		issuePath: `$.challenges[0].runState.initiativeResults.${ids.turn}`,
		message: 'Expected a non-negative whole-number initiative value.'
	},
	{
		field: 'negative initiative result',
		path: ['challenges', 0, 'runState', 'initiativeResults', ids.turn],
		value: -1,
		issuePath: `$.challenges[0].runState.initiativeResults.${ids.turn}`,
		message: 'Expected a non-negative whole-number initiative value.'
	},
	{
		field: 'fractional initiative result',
		path: ['challenges', 0, 'runState', 'initiativeResults', ids.turn],
		value: 1.5,
		issuePath: `$.challenges[0].runState.initiativeResults.${ids.turn}`,
		message: 'Expected a non-negative whole-number initiative value.'
	},
	{
		field: 'generated turn order array',
		path: ['challenges', 0, 'runState', 'generatedTurnOrder'],
		value: null,
		issuePath: '$.challenges[0].runState.generatedTurnOrder',
		message: 'Expected an array.'
	},
	{
		field: 'generated turn order entry',
		path: ['challenges', 0, 'runState', 'generatedTurnOrder', 0],
		value: 'invalid',
		issuePath: '$.challenges[0].runState.generatedTurnOrder[0]',
		message: 'Expected a turn or spawn entry object.'
	},
	{
		field: 'generated turn order entry kind',
		path: ['challenges', 0, 'runState', 'generatedTurnOrder', 0],
		value: { kind: 'other' },
		issuePath: '$.challenges[0].runState.generatedTurnOrder[0].kind',
		message: "Expected 'turn' or 'spawn'."
	},
	{
		field: 'generated turn order id',
		path: ['challenges', 0, 'runState', 'generatedTurnOrder', 0],
		value: { kind: 'turn', turnId: 'invalid' },
		issuePath: '$.challenges[0].runState.generatedTurnOrder[0].turnId',
		message: 'Expected a valid UUID.'
	}
];

const missingTurnId = createUuid();

const invalidReferenceCases = [
	{
		field: 'character creature faction reference',
		path: ['challenges', 0, 'creatures', 0, 'factionId'],
		value: createUuid(),
		issuePath: '$.challenges[0].creatures[0].factionId',
		message: 'References a faction that does not exist.'
	},
	{
		field: 'NPC creature faction reference',
		path: ['challenges', 0, 'creatures', 1, 'factionId'],
		value: createUuid(),
		issuePath: '$.challenges[0].creatures[1].factionId',
		message: 'References a faction that does not exist.'
	},
	{
		field: 'NPC creature type reference',
		path: ['challenges', 0, 'creatures', 1, 'creatureTypeId'],
		value: createUuid(),
		issuePath: '$.challenges[0].creatures[1].creatureTypeId',
		message: 'References an NPC type that does not exist.'
	},
	{
		field: 'relative initiative target reference',
		path: ['challenges', 0, 'creatures', 0, 'turns', 0, 'initiative'],
		value: {
			kind: 'relative-position',
			relation: 'after',
			distance: 1,
			targetTurnId: createUuid()
		},
		issuePath: '$.challenges[0].creatures[0].turns[0].initiative.targetTurnId',
		message: 'References a turn that does not exist in this challenge.'
	},
	{
		field: 'relative initiative self-reference',
		path: ['challenges', 0, 'creatures', 0, 'turns', 0, 'initiative'],
		value: {
			kind: 'relative-position',
			relation: 'after',
			distance: 1,
			targetTurnId: ids.turn
		},
		issuePath: '$.challenges[0].creatures[0].turns[0].initiative.targetTurnId',
		message: 'A turn cannot be positioned relative to itself.'
	},
	{
		field: 'initiative result turn reference',
		path: ['challenges', 0, 'runState', 'initiativeResults'],
		value: { [missingTurnId]: 12 },
		issuePath: `$.challenges[0].runState.initiativeResults.${missingTurnId}`,
		message: 'References a turn that does not exist in this challenge.'
	},
	{
		field: 'initiative result for a non-roll turn',
		path: ['challenges', 0, 'runState', 'initiativeResults'],
		value: { [ids.secondTurn]: 12 },
		issuePath: `$.challenges[0].runState.initiativeResults.${ids.secondTurn}`,
		message: 'Initiative results can only be stored for turns configured to roll.'
	},
	{
		field: 'generated turn order turn reference',
		path: ['challenges', 0, 'runState', 'generatedTurnOrder'],
		value: [{ kind: 'turn', turnId: missingTurnId }],
		issuePath: '$.challenges[0].runState.generatedTurnOrder[0]',
		message: 'References a turn that does not exist in this challenge.'
	},
	{
		field: 'duplicate generated turn order entry',
		path: ['challenges', 0, 'runState', 'generatedTurnOrder'],
		value: [
			{ kind: 'turn', turnId: ids.turn },
			{ kind: 'turn', turnId: ids.turn }
		],
		issuePath: '$.challenges[0].runState.generatedTurnOrder[1]',
		message: 'Turn appears more than once in the order.'
	},
	{
		field: 'duplicate spawn entry',
		path: ['challenges', 0, 'runState', 'generatedTurnOrder'],
		value: [{ kind: 'spawn' }, { kind: 'spawn' }],
		issuePath: '$.challenges[0].runState.generatedTurnOrder[1]',
		message: 'Spawn appears more than once in the order.'
	}
];

describe('challenge domain models', () => {
	it('accepts a structurally and referentially valid challenge library', () => {
		expect(validateChallengeLibrary(library)).toEqual({ isValid: true, value: library });
	});

	it.each([0, 19])('accepts initiative result %s', (initiative) => {
		const libraryWithInitiative = replaceAtPath(
			library,
			['challenges', 0, 'runState', 'initiativeResults'],
			{ [ids.turn]: initiative }
		);

		expect(validateChallengeLibrary(libraryWithInitiative)).toEqual({
			isValid: true,
			value: libraryWithInitiative
		});
	});

	it('requires a faction color', () => {
		const missingColorLibrary = structuredClone(library) as unknown as {
			challenges: { factions: { color?: string }[] }[];
		};
		delete missingColorLibrary.challenges[0]?.factions[0]?.color;

		const result = validateChallengeLibrary(missingColorLibrary);

		expect(result.isValid).toBe(false);
		if (!result.isValid) {
			expect(result.issues).toContainEqual({
				path: '$.challenges[0].factions[0].color',
				message: 'Expected a supported faction color.'
			});
		}
	});

	it.each([null, [], 42])('rejects a non-object challenge library: %s', (value) => {
		expect(validateChallengeLibrary(value)).toEqual({
			isValid: false,
			issues: [{ path: '$', message: 'Expected a challenge library object.' }]
		});
	});

	it('accepts a challenge without optional run state', () => {
		const libraryWithoutRunState: ChallengeLibrary = structuredClone(library);
		delete libraryWithoutRunState.challenges[0].runState;

		expect(validateChallengeLibrary(libraryWithoutRunState)).toEqual({
			isValid: true,
			value: libraryWithoutRunState
		});
	});

	it.each([
		['createdAt', new Date(Number.NaN)],
		['updatedAt', new Date(Number.NaN)],
		['createdAt', '2025-01-02T03:04:05.000Z'],
		['updatedAt', '2025-01-02T03:04:05.000Z'],
		['createdAt', undefined],
		['updatedAt', undefined]
	])('rejects invalid or missing %s dates', (field, date) => {
		const invalidLibrary = {
			...library,
			challenges: library.challenges.map((challenge) => ({
				...challenge,
				[field]: date
			}))
		};

		const result = validateChallengeLibrary(invalidLibrary);

		expect(result.isValid).toBe(false);
		if (!result.isValid) {
			expect(result.issues).toContainEqual({
				path: `$.challenges[0].${field}`,
				message: 'Expected a valid Date.'
			});
		}
	});

	it.each(invalidFieldCases)('rejects invalid $field', ({ path, value, issuePath, message }) => {
		const invalidLibrary = replaceAtPath(
			replaceAtPath(library, ['challenges', 0, 'runState', 'initiativeResults'], {}),
			path,
			value
		);
		const result = validateChallengeLibrary(invalidLibrary);

		expect(result.isValid).toBe(false);
		if (!result.isValid) {
			expect(result.issues).toContainEqual({ path: issuePath, message });
		}
	});

	it.each(invalidReferenceCases)(
		'rejects invalid $field',
		({ path, value, issuePath, message }) => {
			const invalidLibrary = replaceAtPath(library, path, value);
			const result = validateChallengeLibrary(invalidLibrary);

			expect(result.isValid).toBe(false);
			if (!result.isValid) {
				expect(result.issues).toContainEqual({ path: issuePath, message });
			}
		}
	);

	it.each(initiativeExamples)('accepts the "$kind" initiative rule', (initiative) => {
		const validLibrary = replaceAtPath(
			replaceAtPath(library, ['challenges', 0, 'runState', 'initiativeResults'], {}),
			['challenges', 0, 'creatures', 0, 'turns', 0, 'initiative'],
			initiative
		);

		expect(validateChallengeLibrary(validLibrary).isValid).toBe(true);
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

	it('rejects unsupported library versions', () => {
		const unsupportedVersion = { ...library, formatVersion: 2 };
		const versionResult = validateChallengeLibrary(unsupportedVersion);

		expect(versionResult.isValid).toBe(false);
		if (!versionResult.isValid) {
			expect(versionResult.issues).toContainEqual({
				path: '$.formatVersion',
				message: 'Unsupported challenge library version.'
			});
		}
	});

	const withCharacterStat = (initiativeStat: number) => ({
		...library,
		challenges: library.challenges.map((challenge) => ({
			...challenge,
			creatures: challenge.creatures.map((creature) =>
				creature.kind === 'character' ? { ...creature, initiativeStat } : creature
			)
		}))
	});

	it('accepts characters without an initiative stat or with a finite initiative stat', () => {
		expect(validateChallengeLibrary(library).isValid).toBe(true);
		expect(validateChallengeLibrary(withCharacterStat(3)).isValid).toBe(true);
		expect(validateChallengeLibrary(withCharacterStat(0)).isValid).toBe(true);
		expect(validateChallengeLibrary(withCharacterStat(-1)).isValid).toBe(true);
		expect(validateChallengeLibrary(withCharacterStat(1.5)).isValid).toBe(true);
	});

	it('accepts finite numeric values that fail setup readiness rules', () => {
		const invalidSetupLibrary: ChallengeLibrary = structuredClone(library);
		const challenge = invalidSetupLibrary.challenges[0]!;
		challenge.fairnessWeight = -1;
		challenge.npcTypes[0]!.initiativeStat = 0;
		const character = challenge.creatures[0];
		if (character?.kind === 'character') {
			character.initiativeStat = -1;
			character.turns[0]!.initiative = {
				kind: 'relative-position',
				relation: 'before',
				distance: -1,
				targetTurnId: ids.secondTurn
			};
			character.turns[1]!.initiative = {
				kind: 'fixed-position',
				from: 'top',
				position: 0.5
			};
		}
		delete challenge.runState;

		expect(validateChallengeLibrary(invalidSetupLibrary).isValid).toBe(true);
	});

	it.each([Number.NaN, Infinity, -Infinity])(
		'rejects non-finite player initiative stat %s',
		(initiativeStat) => {
			const result = validateChallengeLibrary(withCharacterStat(initiativeStat));

			expect(result.isValid).toBe(false);
			if (!result.isValid) {
				expect(result.issues).toContainEqual({
					path: '$.challenges[0].creatures[0].initiativeStat',
					message: 'Expected a finite number.'
				});
			}
		}
	);

	it('reports independent shape and reference issues in the same validation pass', () => {
		const invalidLibrary = {
			...library,
			challenges: library.challenges.map((challenge) => ({
				...challenge,
				npcTypes: challenge.npcTypes.map((npcType) => ({
					...npcType,
					name: 4,
					initiativeStat: Infinity
				})),
				creatures: challenge.creatures.map((creature, index) =>
					index === 0 ? { ...creature, name: 7, factionId: createUuid() } : creature
				)
			}))
		};

		const result = validateChallengeLibrary(invalidLibrary);

		expect(result.isValid).toBe(false);
		if (!result.isValid) {
			expect(result.issues).toHaveLength(4);
			expect(result.issues).toContainEqual({
				path: '$.challenges[0].creatures[0].name',
				message: 'Expected a string.'
			});
			expect(result.issues).toContainEqual({
				path: '$.challenges[0].npcTypes[0].name',
				message: 'Expected a string.'
			});
			expect(result.issues).toContainEqual({
				path: '$.challenges[0].npcTypes[0].initiativeStat',
				message: 'Expected a finite number.'
			});
			expect(result.issues).toContainEqual({
				path: '$.challenges[0].creatures[0].factionId',
				message: 'References a faction that does not exist.'
			});
		}
	});

	it('rejects duplicate entity IDs', () => {
		const invalidLibrary = structuredClone(library);
		invalidLibrary.challenges[0].npcTypes[0].id = invalidLibrary.challenges[0].factions[0].id;

		const result = validateChallengeLibrary(invalidLibrary);

		expect(result.isValid).toBe(false);
		if (!result.isValid) {
			expect(result.issues).toContainEqual({
				path: '$.challenges[0].npcTypes[0].id',
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

	it('represents characters, challenge entities, and turn references', () => {
		const challenge = library.challenges[0];

		expect(challenge.creatures[0].kind).toBe('character');
		expect(challenge.creatures[0].turns[1].initiative).toEqual({
			kind: 'fixed-position',
			from: 'bottom',
			position: 1
		});
		expect('characters' in library).toBe(false);
		expect('people' in library).toBe(false);
		expect('groups' in library).toBe(false);
		expect('groupIds' in challenge).toBe(false);
		expect(initiativeResults[ids.turn]).toBe(12);
		expect(generatedTurnOrder).toEqual([
			{ kind: 'turn', turnId: ids.turn },
			{ kind: 'turn', turnId: ids.secondTurn },
			{ kind: 'spawn' }
		]);
		expect(challenge.runState.initiativeResults[ids.turn]).toBe(12);
		expect(challenge.runState.generatedTurnOrder).toEqual([
			{ kind: 'turn', turnId: ids.turn },
			{ kind: 'turn', turnId: ids.secondTurn },
			{ kind: 'turn', turnId: ids.secondTurnId },
			{ kind: 'spawn' }
		]);
		expect(initiativeExamples.map(({ kind }) => kind)).toEqual([
			'roll',
			'roll',
			'static',
			'fixed-position',
			'fixed-position',
			'relative-position',
			'relative-position'
		]);
	});
});
