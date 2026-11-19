import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Challenge, ChallengeLibrary, StableId } from '../core/model';
import { createChallengeJson, readChallengeJsonFile } from './json-files';
import {
	ChallengeImportError,
	copyChallengeSettings,
	prepareChallengeImport,
	saveChallengeToJsonFile
} from './challenge-files';
import { loadChallengeLibrary, saveChallengeLibrary } from '../storage/storage';
import { createUuid } from '../core/uuid';
import { validateChallengeLibrary } from '../core/validation';

const DATABASE_NAME = 'soulstone-challenge-library';
const challengeId = createUuid();
const factionId = createUuid();
const creatureId = createUuid();
const turnId = createUuid();
const secondTurnId = createUuid();
let indexedDbFactory: IDBFactory;

function createChallenge(id: StableId = challengeId, name = 'The Old Keep'): Challenge {
	return {
		id,
		name,
		createdAt: new Date('2025-01-02T03:04:05.000Z'),
		updatedAt: new Date('2025-01-02T03:04:05.000Z'),
		factions: [{ id: factionId, name: 'Adventurers', color: 'blue' }],
		npcTypes: [],
		fairnessWeight: 3,
		creatures: [
			{
				id: creatureId,
				kind: 'character',
				name: 'Aria',
				initiativeStat: 2,
				factionId,
				isHidden: true,
				turns: [
					{
						id: turnId,
						initiative: {
							kind: 'relative-position',
							relation: 'before',
							index: 1,
							targetTurnId: secondTurnId
						}
					},
					{ id: secondTurnId, initiative: { kind: 'roll', mode: 'app' } }
				]
			}
		],
		runState: {
			initiativeResults: { [secondTurnId]: 13 },
			tieDecisions: [[secondTurnId, turnId]],
			generatedTurnOrder: [
				{ kind: 'turn', turnId },
				{ kind: 'turn', turnId: secondTurnId },
				{ kind: 'spawn' }
			]
		}
	};
}

const library: ChallengeLibrary = {
	formatVersion: 1,
	challenges: [createChallenge()]
};
const emptyLibrary: ChallengeLibrary = { formatVersion: 1, challenges: [] };

function deleteDatabase(): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDbFactory.deleteDatabase(DATABASE_NAME);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		request.onblocked = () => reject(new Error('Deleting the test database was blocked.'));
	});
}

function createJsonFile(json: string): File {
	return new File([json], 'challenge.json', { type: 'application/json' });
}

async function readChallengeFile(json: string) {
	return readChallengeJsonFile(createJsonFile(json));
}

function stubObjectUrl(
	createObjectUrl: () => string,
	revokeObjectUrl: (url: string) => void
): void {
	const urlConstructor = class extends URL {};
	Reflect.set(urlConstructor, 'createObjectURL', createObjectUrl);
	Reflect.set(urlConstructor, 'revokeObjectURL', revokeObjectUrl);
	vi.stubGlobal('URL', urlConstructor);
}

beforeEach(async () => {
	indexedDbFactory = new IDBFactory();
	await deleteDatabase();
});

afterEach(async () => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	await deleteDatabase();
});

describe('challenge file workflows', () => {
	it('assigns fresh IDs to every copied entity even without local identity collisions', async () => {
		const readResult = await readChallengeFile(createChallengeJson(library, challengeId));
		const copied = prepareChallengeImport(emptyLibrary, readResult, {
			resolution: 'copy'
		}).challenge;
		expect(copied.id).not.toBe(challengeId);
		expect(copied.factions[0]?.id).not.toBe(factionId);
		expect(copied.creatures[0]?.id).not.toBe(creatureId);
		expect(copied.creatures[0]?.turns[0]?.id).not.toBe(turnId);
		expect(copied.creatures[0]?.turns[1]?.id).not.toBe(secondTurnId);
		expect(validateChallengeLibrary({ formatVersion: 1, challenges: [copied] }).isValid).toBe(true);
	});

	it('copies setup settings with fresh IDs and without run state', () => {
		const npcTypeId = createUuid();
		const npcCreatureId = createUuid();
		const npcTurnId = createUuid();
		const source = createChallenge();
		source.npcTypes = [{ id: npcTypeId, name: 'Skeleton', initiativeStat: 2 }];
		source.creatures.push({
			id: npcCreatureId,
			kind: 'npc',
			creatureTypeId: npcTypeId,
			identifier: 'A',
			factionId,
			isHidden: false,
			turns: [{ id: npcTurnId, initiative: { kind: 'static', value: 8 } }]
		});
		source.runState = {
			initiativeResults: { [secondTurnId]: 13, [npcTurnId]: 8 },
			tieDecisions: [[secondTurnId, turnId]],
			spawnCount: 2,
			spawnEdit: {
				newCreatureIds: [npcCreatureId],
				newNpcTypeIds: [npcTypeId],
				newTurnIds: [npcTurnId],
				lockedInitiativeTurnIds: [secondTurnId]
			},
			generatedTurnOrder: [{ kind: 'turn', turnId: secondTurnId }, { kind: 'spawn' }]
		};
		const original = structuredClone(source);
		const copyStartedAt = Date.now();

		const copied = copyChallengeSettings(source, {
			formatVersion: 1,
			challenges: [source]
		});
		const copyFinishedAt = Date.now();
		const sourceIds = [
			source.id,
			...source.factions.map(({ id }) => id),
			...source.npcTypes.map(({ id }) => id),
			...source.creatures.flatMap((creature) => [
				creature.id,
				...creature.turns.map(({ id }) => id)
			])
		];
		const copiedIds = [
			copied.id,
			...copied.factions.map(({ id }) => id),
			...copied.npcTypes.map(({ id }) => id),
			...copied.creatures.flatMap((creature) => [
				creature.id,
				...creature.turns.map(({ id }) => id)
			])
		];
		const copiedCharacter = copied.creatures.find((creature) => creature.kind === 'character');
		const copiedNpc = copied.creatures.find((creature) => creature.kind === 'npc');

		expect(copied.name).toBe(source.name);
		expect(copied.fairnessWeight).toBe(source.fairnessWeight);
		expect(copied.factions[0]).toMatchObject({ name: 'Adventurers', color: 'blue' });
		expect(copied.npcTypes[0]).toMatchObject({ name: 'Skeleton', initiativeStat: 2 });
		expect(copiedCharacter).toMatchObject({
			kind: 'character',
			name: 'Aria',
			isHidden: true,
			factionId: copied.factions[0]?.id,
			turns: [
				{
					initiative: {
						kind: 'relative-position',
						relation: 'before',
						index: 1,
						targetTurnId:
							copiedCharacter.kind === 'character' ? copiedCharacter.turns[1]?.id : undefined
					}
				},
				{ initiative: { kind: 'roll', mode: 'app' } }
			]
		});
		expect(copiedNpc).toMatchObject({
			kind: 'npc',
			creatureTypeId: copied.npcTypes[0]?.id,
			identifier: 'A',
			turns: [{ initiative: { kind: 'static', value: 8 } }]
		});
		expect(copiedIds).toHaveLength(sourceIds.length);
		expect(new Set(copiedIds).size).toBe(copiedIds.length);
		expect(copiedIds.some((id) => sourceIds.includes(id))).toBe(false);
		expect(copied.createdAt.getTime()).toBeGreaterThanOrEqual(copyStartedAt);
		expect(copied.createdAt.getTime()).toBeLessThanOrEqual(copyFinishedAt);
		expect(copied.updatedAt.getTime()).toBe(copied.createdAt.getTime());
		expect(copied.createdAt).not.toBe(copied.updatedAt);
		expect(copied).not.toHaveProperty('runState');
		expect(source).toEqual(original);
		expect(validateChallengeLibrary({ formatVersion: 1, challenges: [copied] }).isValid).toBe(true);
	});

	it('saves a running challenge snapshot with its initiative state', async () => {
		const createObjectUrl = vi.fn(() => 'blob:challenge');
		const revokeObjectUrl = vi.fn();
		stubObjectUrl(createObjectUrl, revokeObjectUrl);
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

		await saveChallengeToJsonFile(library, challengeId);

		expect(createObjectUrl).toHaveBeenCalledOnce();
		expect(click).toHaveBeenCalledOnce();
	});

	it('prepares a single challenge import without persisting it', async () => {
		const readResult = await readChallengeFile(createChallengeJson(library, challengeId));
		const preparedImport = prepareChallengeImport(emptyLibrary, readResult);

		expect(preparedImport.challenge).toEqual(library.challenges[0]);
		expect(preparedImport.library).toEqual(library);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(emptyLibrary);
		await saveChallengeLibrary(preparedImport.library, indexedDbFactory);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(library);
	});

	it('round-trips finite setup-invalid values in a challenge file', async () => {
		const challenge = createChallenge();
		challenge.fairnessWeight = -1;
		const character = challenge.creatures[0];
		if (character?.kind === 'character') character.initiativeStat = 0;
		const invalidSetupLibrary = { ...library, challenges: [challenge] };
		const readResult = await readChallengeFile(
			createChallengeJson(invalidSetupLibrary, challenge.id)
		);

		const preparedImport = prepareChallengeImport(emptyLibrary, readResult);

		expect(preparedImport.challenge).toEqual(challenge);
	});

	it('requires confirmation for a partially invalid file and rejects it without a valid challenge', async () => {
		const partialFile = createJsonFile(
			JSON.stringify({
				...library,
				challenges: [{ ...library.challenges[0], id: 'invalid-id' }]
			})
		);

		const readResult = await readChallengeJsonFile(partialFile);

		expect(() => prepareChallengeImport(emptyLibrary, readResult)).toThrow(
			expect.objectContaining({
				code: 'partial-import-required',
				issues: [expect.objectContaining({ path: '$.challenges[0].id' })]
			})
		);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual({
			formatVersion: 1,
			challenges: []
		});

		expect(() =>
			prepareChallengeImport(emptyLibrary, readResult, { partialImport: 'import-valid' })
		).toThrow(expect.objectContaining({ code: 'no-importable-data' }));
	});

	it('rejects partial imports when the caller chooses to abort', async () => {
		const partialFile = createJsonFile(
			JSON.stringify({
				...library,
				challenges: [{ ...library.challenges[0], id: 'invalid-id' }]
			})
		);

		const readResult = await readChallengeJsonFile(partialFile);

		expect(() =>
			prepareChallengeImport(emptyLibrary, readResult, { partialImport: 'abort' })
		).toThrow(expect.objectContaining({ code: 'partial-import-aborted' }));
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual({
			formatVersion: 1,
			challenges: []
		});
	});

	it('requires an explicit choice when the challenge ID already exists', async () => {
		await saveChallengeLibrary(library, indexedDbFactory);
		const readResult = await readChallengeFile(createChallengeJson(library, challengeId));

		expect(() => prepareChallengeImport(library, readResult)).toThrow(
			expect.objectContaining({ code: 'challenge-conflict', challengeId })
		);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(library);
	});

	it('does not replace a challenge that is active', async () => {
		await saveChallengeLibrary(library, indexedDbFactory);
		const replacement = { ...library, challenges: [createChallenge(challengeId, 'Updated')] };
		const readResult = await readChallengeFile(createChallengeJson(replacement, challengeId));

		expect(() =>
			prepareChallengeImport(library, readResult, {
				resolution: 'replace',
				activeChallengeIds: new Set([challengeId])
			})
		).toThrow(ChallengeImportError);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(library);
	});

	it('replaces an inactive matching challenge', async () => {
		await saveChallengeLibrary(library, indexedDbFactory);
		const replacement = { ...library, challenges: [createChallenge(challengeId, 'Updated')] };

		const readResult = await readChallengeFile(createChallengeJson(replacement, challengeId));
		const preparedImport = prepareChallengeImport(library, readResult, {
			resolution: 'replace',
			activeChallengeIds: new Set()
		});

		expect(preparedImport.challenge.name).toBe('Updated');
		await saveChallengeLibrary(preparedImport.library, indexedDbFactory);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(replacement);
	});

	it('imports a copy with fresh IDs and preserved references and run state', async () => {
		await saveChallengeLibrary(library, indexedDbFactory);

		const readResult = await readChallengeFile(createChallengeJson(library, challengeId));
		const copyStartedAt = new Date();
		const preparedImport = prepareChallengeImport(library, readResult, {
			resolution: 'copy'
		});
		const copiedChallenge = preparedImport.challenge;
		await saveChallengeLibrary(preparedImport.library, indexedDbFactory);
		const updatedLibrary = await loadChallengeLibrary(indexedDbFactory);
		const validation = validateChallengeLibrary(updatedLibrary);

		expect(copiedChallenge.id).not.toBe(challengeId);
		expect(copiedChallenge.factions[0]?.color).toBe('blue');
		expect(copiedChallenge.createdAt).not.toBe(library.challenges[0]?.createdAt);
		expect(copiedChallenge.updatedAt).not.toBe(library.challenges[0]?.updatedAt);
		expect(copiedChallenge.createdAt.getTime()).toBeGreaterThanOrEqual(copyStartedAt.getTime());
		expect(copiedChallenge.updatedAt.getTime()).toBe(copiedChallenge.createdAt.getTime());
		expect(copiedChallenge.createdAt).not.toBe(copiedChallenge.updatedAt);
		expect(copiedChallenge.creatures[0]?.id).not.toBe(creatureId);
		expect(copiedChallenge.creatures[0]?.isHidden).toBe(true);
		expect(copiedChallenge.creatures[0]?.turns[0]?.id).not.toBe(turnId);
		expect(copiedChallenge.runState?.initiativeResults).toEqual({
			[copiedChallenge.creatures[0]?.turns[1]?.id ?? '']: 13
		});
		expect(copiedChallenge.creatures[0]?.turns[0]?.initiative).toMatchObject({
			kind: 'relative-position',
			index: 1,
			targetTurnId: copiedChallenge.creatures[0]?.turns[1]?.id
		});
		expect(copiedChallenge.runState?.tieDecisions).toEqual([
			[copiedChallenge.creatures[0]?.turns[1]?.id, copiedChallenge.creatures[0]?.turns[0]?.id]
		]);
		expect(copiedChallenge.runState?.generatedTurnOrder).toEqual([
			{ kind: 'turn', turnId: copiedChallenge.creatures[0]?.turns[0]?.id },
			{ kind: 'turn', turnId: copiedChallenge.creatures[0]?.turns[1]?.id },
			{ kind: 'spawn' }
		]);
		expect(updatedLibrary.challenges).toHaveLength(2);
		expect(updatedLibrary.challenges[0]?.createdAt).toBeInstanceOf(Date);
		expect(updatedLibrary.challenges[1]?.createdAt).toBeInstanceOf(Date);
		expect(validation.isValid).toBe(true);
	});

	it('remaps Spawn editing references when importing a copy', async () => {
		const editing = createChallenge();
		editing.npcTypes = [{ id: createUuid(), name: 'Skeleton', initiativeStat: 2 }];
		editing.runState = {
			initiativeResults: { [secondTurnId]: 13 },
			generatedTurnOrder: [{ kind: 'spawn' }],
			spawnEdit: {
				newCreatureIds: [creatureId],
				newNpcTypeIds: [editing.npcTypes[0].id],
				newTurnIds: [turnId],
				lockedInitiativeTurnIds: [secondTurnId]
			}
		};
		const editingLibrary: ChallengeLibrary = { formatVersion: 1, challenges: [editing] };

		const readResult = await readChallengeFile(createChallengeJson(editingLibrary, challengeId));
		const copy = prepareChallengeImport(library, readResult, { resolution: 'copy' }).challenge;

		expect(copy.runState?.spawnEdit).toEqual({
			newCreatureIds: [copy.creatures[0]?.id],
			newNpcTypeIds: [copy.npcTypes[0]?.id],
			newTurnIds: [copy.creatures[0]?.turns[0]?.id],
			lockedInitiativeTurnIds: [copy.creatures[0]?.turns[1]?.id]
		});
		expect(copy.runState?.spawnEdit?.newCreatureIds[0]).not.toBe(creatureId);
		expect(copy.runState?.generatedTurnOrder).toEqual([{ kind: 'spawn' }]);
		expect(validateChallengeLibrary({ formatVersion: 1, challenges: [copy] }).isValid).toBe(true);
	});

	it('round-trips Spawn editing state through a JSON file', async () => {
		const editing = createChallenge();
		editing.runState = {
			initiativeResults: { [secondTurnId]: 13 },
			generatedTurnOrder: [{ kind: 'spawn' }],
			spawnEdit: {
				newCreatureIds: [],
				newNpcTypeIds: [],
				newTurnIds: [turnId],
				lockedInitiativeTurnIds: [secondTurnId]
			}
		};
		const editingLibrary: ChallengeLibrary = { formatVersion: 1, challenges: [editing] };

		const readResult = await readChallengeFile(createChallengeJson(editingLibrary, challengeId));
		const imported = prepareChallengeImport(emptyLibrary, readResult, {
			resolution: 'replace',
			activeChallengeIds: new Set()
		}).challenge;

		expect(imported.runState?.spawnEdit).toEqual(editing.runState.spawnEdit);
	});

	it('copies only modeled fields when preparing existing challenges for an import', async () => {
		const challengeWithExtraFields = {
			...library.challenges[0],
			privateChallengeField: 'not-for-copy',
			creatures: library.challenges[0].creatures.map((creature) => ({
				...creature,
				privateCreatureField: 'not-for-copy'
			}))
		};
		const libraryWithExtraFields = {
			...library,
			challenges: [challengeWithExtraFields]
		};
		const readResult = await readChallengeFile(createChallengeJson(library, challengeId));

		const preparedImport = prepareChallengeImport(libraryWithExtraFields, readResult, {
			resolution: 'copy'
		});
		const copiedChallenge = preparedImport.library.challenges[0];

		expect(copiedChallenge).not.toHaveProperty('privateChallengeField');
		expect(copiedChallenge?.creatures[0]).not.toHaveProperty('privateCreatureField');
	});
});
