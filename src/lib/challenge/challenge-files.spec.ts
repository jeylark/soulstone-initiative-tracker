import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Challenge, ChallengeLibrary, StableId } from './model';
import { createChallengeJson, readChallengeJsonFile } from './json-files';
import {
	ChallengeImportError,
	prepareChallengeImport,
	prepareCharacterImport,
	PartialChallengeImportError,
	saveChallengeToJsonFile
} from './challenge-files';
import { loadChallengeLibrary, saveChallengeLibrary } from './storage';
import { createUuid } from './uuid';
import { validateChallengeLibrary } from './validation';

const DATABASE_NAME = 'soulstone-challenge-library';
const characterId = createUuid();
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
		factions: [{ id: factionId, name: 'Adventurers' }],
		npcTypes: [],
		initiativeRollModes: { characters: 'manual', npcs: 'app' },
		creatures: [
			{
				id: creatureId,
				kind: 'character',
				characterId,
				factionId,
				turns: [
					{
						id: turnId,
						isHidden: false,
						initiative: {
							kind: 'relative-position',
							relation: 'before',
							distance: 1,
							targetTurnId: secondTurnId
						}
					},
					{ id: secondTurnId, isHidden: false, initiative: { kind: 'roll' } }
				]
			}
		],
		runState: {
			initiativeResults: { [secondTurnId]: 13 },
			generatedTurnOrder: [turnId, secondTurnId]
		}
	};
}

const library: ChallengeLibrary = {
	formatVersion: 1,
	characters: [{ id: characterId, name: 'Aria' }],
	challenges: [createChallenge()]
};
const emptyLibrary: ChallengeLibrary = { formatVersion: 1, characters: [], challenges: [] };

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
	it('saves a running challenge snapshot with its initiative state', async () => {
		const createObjectUrl = vi.fn(() => 'blob:challenge');
		const revokeObjectUrl = vi.fn();
		stubObjectUrl(createObjectUrl, revokeObjectUrl);
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

		saveChallengeToJsonFile(library, challengeId);

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

	it('requires confirmation before importing valid data from a partially invalid file', async () => {
		const partialFile = createJsonFile(
			JSON.stringify({
				...library,
				characters: [...library.characters, { id: 'invalid-id', name: 'Broken' }]
			})
		);

		const readResult = await readChallengeJsonFile(partialFile);

		expect(() => prepareChallengeImport(emptyLibrary, readResult)).toThrow(
			expect.objectContaining({
				code: 'partial-import-required',
				issues: [expect.objectContaining({ path: '$.characters[1].id' })]
			})
		);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual({
			formatVersion: 1,
			characters: [],
			challenges: []
		});

		const preparedImport = prepareChallengeImport(emptyLibrary, readResult, {
			partialImport: 'import-valid'
		});
		expect(preparedImport.challenge).toEqual(library.challenges[0]);
		await saveChallengeLibrary(preparedImport.library, indexedDbFactory);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(library);
	});

	it('imports valid characters while skipping an invalid challenge when requested', async () => {
		const partialFile = createJsonFile(
			JSON.stringify({
				...library,
				challenges: [{ ...library.challenges[0], name: 7 }]
			})
		);

		const readResult = await readChallengeJsonFile(partialFile);

		expect(() => prepareCharacterImport(emptyLibrary, readResult)).toThrow(
			PartialChallengeImportError
		);
		const preparedImport = prepareCharacterImport(emptyLibrary, readResult, 'import-valid');
		expect(preparedImport.importedCharacters).toEqual(library.characters);
		await saveChallengeLibrary(preparedImport.library, indexedDbFactory);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual({
			formatVersion: 1,
			characters: library.characters,
			challenges: []
		});
	});

	it('rejects partial imports when the caller chooses to abort', async () => {
		const partialFile = createJsonFile(
			JSON.stringify({
				...library,
				characters: [{ id: 'invalid-id', name: 'Broken' }]
			})
		);

		const readResult = await readChallengeJsonFile(partialFile);

		expect(() => prepareCharacterImport(emptyLibrary, readResult, 'abort')).toThrow(
			expect.objectContaining({ code: 'partial-import-aborted' })
		);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual({
			formatVersion: 1,
			characters: [],
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
		expect(copiedChallenge.createdAt).not.toBe(library.challenges[0]?.createdAt);
		expect(copiedChallenge.updatedAt).not.toBe(library.challenges[0]?.updatedAt);
		expect(copiedChallenge.createdAt.getTime()).toBeGreaterThanOrEqual(copyStartedAt.getTime());
		expect(copiedChallenge.updatedAt.getTime()).toBe(copiedChallenge.createdAt.getTime());
		expect(copiedChallenge.createdAt).not.toBe(copiedChallenge.updatedAt);
		expect(copiedChallenge.creatures[0]?.id).not.toBe(creatureId);
		expect(copiedChallenge.creatures[0]?.turns[0]?.id).not.toBe(turnId);
		expect(copiedChallenge.runState?.initiativeResults).toEqual({
			[copiedChallenge.creatures[0]?.turns[1]?.id ?? '']: 13
		});
		expect(copiedChallenge.creatures[0]?.turns[0]?.initiative).toMatchObject({
			kind: 'relative-position',
			targetTurnId: copiedChallenge.creatures[0]?.turns[1]?.id
		});
		expect(copiedChallenge.runState?.generatedTurnOrder).toEqual([
			copiedChallenge.creatures[0]?.turns[0]?.id,
			copiedChallenge.creatures[0]?.turns[1]?.id
		]);
		expect(updatedLibrary.challenges).toHaveLength(2);
		expect(updatedLibrary.challenges[0]?.createdAt).toBeInstanceOf(Date);
		expect(updatedLibrary.challenges[1]?.createdAt).toBeInstanceOf(Date);
		expect(validation.isValid).toBe(true);
	});

	it('remaps imported character IDs when a conflicting ID has different data', async () => {
		await saveChallengeLibrary(library, indexedDbFactory);
		const changedCharacterLibrary = {
			...library,
			characters: [{ id: characterId, name: 'Different Aria' }]
		};

		const readResult = await readChallengeFile(
			createChallengeJson(changedCharacterLibrary, challengeId)
		);
		const preparedImport = prepareChallengeImport(library, readResult, { resolution: 'copy' });
		const copiedChallenge = preparedImport.challenge;
		await saveChallengeLibrary(preparedImport.library, indexedDbFactory);
		const updatedLibrary = await loadChallengeLibrary(indexedDbFactory);
		const importedCharacterId =
			copiedChallenge.creatures[0]?.kind === 'character'
				? copiedChallenge.creatures[0].characterId
				: null;

		expect(importedCharacterId).not.toBe(characterId);
		expect(updatedLibrary.characters).toContainEqual({
			id: importedCharacterId,
			name: 'Different Aria'
		});
		expect(validateChallengeLibrary(updatedLibrary).isValid).toBe(true);
	});

	it('loads characters from a challenge file without importing its challenge', async () => {
		const readResult = await readChallengeFile(createChallengeJson(library, challengeId));
		const preparedImport = prepareCharacterImport(emptyLibrary, readResult);

		expect(preparedImport.importedCharacters).toEqual(library.characters);
		await saveChallengeLibrary(preparedImport.library, indexedDbFactory);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual({
			formatVersion: 1,
			characters: library.characters,
			challenges: []
		});
	});

	it('does not duplicate reusable characters already in the database', async () => {
		await saveChallengeLibrary(library, indexedDbFactory);

		const readResult = await readChallengeFile(createChallengeJson(library, challengeId));
		const preparedImport = prepareCharacterImport(library, readResult);

		expect(preparedImport.importedCharacters).toEqual(library.characters);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(library);
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

		const preparedImport = prepareCharacterImport(libraryWithExtraFields, readResult);
		const copiedChallenge = preparedImport.library.challenges[0];

		expect(copiedChallenge).not.toHaveProperty('privateChallengeField');
		expect(copiedChallenge?.creatures[0]).not.toHaveProperty('privateCreatureField');
	});
});
