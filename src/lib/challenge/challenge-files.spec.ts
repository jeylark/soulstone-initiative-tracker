import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Challenge, ChallengeLibrary, StableId } from './model';
import { createChallengeJson } from './json-files';
import {
	ChallengeImportError,
	loadChallengeFromJsonFile,
	loadCharactersFromChallengeJsonFile,
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

	it('loads a single challenge and its characters into the library', async () => {
		const challengeFile = createJsonFile(createChallengeJson(library, challengeId));

		const loadedChallenge = await loadChallengeFromJsonFile(
			challengeFile,
			undefined,
			indexedDbFactory
		);

		expect(loadedChallenge).toEqual(library.challenges[0]);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(library);
	});

	it('requires an explicit choice when the challenge ID already exists', async () => {
		await saveChallengeLibrary(library, indexedDbFactory);
		const challengeFile = createJsonFile(createChallengeJson(library, challengeId));

		await expect(
			loadChallengeFromJsonFile(challengeFile, undefined, indexedDbFactory)
		).rejects.toMatchObject({ code: 'challenge-conflict', challengeId });
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(library);
	});

	it('does not replace a challenge that is active', async () => {
		await saveChallengeLibrary(library, indexedDbFactory);
		const replacement = { ...library, challenges: [createChallenge(challengeId, 'Updated')] };

		await expect(
			loadChallengeFromJsonFile(
				createJsonFile(createChallengeJson(replacement, challengeId)),
				{ resolution: 'replace', activeChallengeIds: new Set([challengeId]) },
				indexedDbFactory
			)
		).rejects.toBeInstanceOf(ChallengeImportError);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(library);
	});

	it('replaces an inactive matching challenge', async () => {
		await saveChallengeLibrary(library, indexedDbFactory);
		const replacement = { ...library, challenges: [createChallenge(challengeId, 'Updated')] };

		const imported = await loadChallengeFromJsonFile(
			createJsonFile(createChallengeJson(replacement, challengeId)),
			{ resolution: 'replace', activeChallengeIds: new Set() },
			indexedDbFactory
		);

		expect(imported.name).toBe('Updated');
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(replacement);
	});

	it('imports a copy with fresh IDs and preserved references and run state', async () => {
		await saveChallengeLibrary(library, indexedDbFactory);

		const copiedChallenge = await loadChallengeFromJsonFile(
			createJsonFile(createChallengeJson(library, challengeId)),
			{ resolution: 'copy' },
			indexedDbFactory
		);
		const updatedLibrary = await loadChallengeLibrary(indexedDbFactory);
		const validation = validateChallengeLibrary(updatedLibrary);

		expect(copiedChallenge.id).not.toBe(challengeId);
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
		expect(validation.isValid).toBe(true);
	});

	it('remaps imported character IDs when a conflicting ID has different data', async () => {
		await saveChallengeLibrary(library, indexedDbFactory);
		const changedCharacterLibrary = {
			...library,
			characters: [{ id: characterId, name: 'Different Aria' }]
		};

		const copiedChallenge = await loadChallengeFromJsonFile(
			createJsonFile(createChallengeJson(changedCharacterLibrary, challengeId)),
			{ resolution: 'copy' },
			indexedDbFactory
		);
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
		const importedCharacters = await loadCharactersFromChallengeJsonFile(
			createJsonFile(createChallengeJson(library, challengeId)),
			indexedDbFactory
		);

		expect(importedCharacters).toEqual(library.characters);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual({
			formatVersion: 1,
			characters: library.characters,
			challenges: []
		});
	});

	it('does not duplicate reusable characters already in the database', async () => {
		await saveChallengeLibrary(library, indexedDbFactory);

		const importedCharacters = await loadCharactersFromChallengeJsonFile(
			createJsonFile(createChallengeJson(library, challengeId)),
			indexedDbFactory
		);

		expect(importedCharacters).toEqual(library.characters);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(library);
	});
});
