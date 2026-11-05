import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Challenge, ChallengeLibrary, StableId } from './model';
import {
	ChallengeJsonFileError,
	createChallengeJson,
	createChallengeLibraryJson,
	downloadChallengeLibraryJson,
	downloadChallengeJson,
	parseChallengeJson,
	parseChallengeLibraryJson,
	readChallengeJsonFile,
	readChallengeLibraryJsonFile
} from './json-files';
import { createUuid } from './uuid';

const firstCharacterId = createUuid();
const secondCharacterId = createUuid();
const firstChallengeId = createUuid();
const secondChallengeId = createUuid();

function createChallenge(id: StableId, characterId: StableId, name: string): Challenge {
	const factionId = createUuid();
	const turnId = createUuid();

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
				id: createUuid(),
				kind: 'character',
				characterId,
				factionId,
				isHidden: false,
				turns: [{ id: turnId, initiative: { kind: 'roll', mode: 'manual' } }]
			}
		],
		runState: {
			initiativeResults: { [turnId]: 12 },
			generatedTurnOrder: [turnId]
		}
	};
}

const library: ChallengeLibrary = {
	formatVersion: 1,
	characters: [
		{ id: firstCharacterId, name: 'Aria' },
		{ id: secondCharacterId, name: 'Bram' }
	],
	challenges: [
		createChallenge(firstChallengeId, firstCharacterId, 'The Old Keep'),
		createChallenge(secondChallengeId, secondCharacterId, 'The Sunken Vault')
	]
};

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function stubObjectUrl(
	createObjectUrl: () => string,
	revokeObjectUrl: (url: string) => void
): void {
	const urlConstructor = class extends URL {};
	Reflect.set(urlConstructor, 'createObjectURL', createObjectUrl);
	Reflect.set(urlConstructor, 'revokeObjectURL', revokeObjectUrl);
	vi.stubGlobal('URL', urlConstructor);
}

describe('challenge and library JSON files', () => {
	it('serializes a whole library as readable, versioned JSON', () => {
		const json = createChallengeLibraryJson(library);

		expect(json).toContain('\n  "formatVersion": 1');
		expect(JSON.parse(json).challenges[0]).toMatchObject({
			createdAt: library.challenges[0]?.createdAt.toISOString(),
			updatedAt: library.challenges[0]?.updatedAt.toISOString()
		});
		expect(JSON.parse(json).challenges[0]).not.toHaveProperty('initiativeRollModes');
		expect(JSON.parse(json).challenges[0].creatures[0].turns[0].initiative).toEqual({
			kind: 'roll',
			mode: 'manual'
		});
		expect(JSON.parse(json).challenges[0].factions[0].color).toBe('blue');
	});

	it('does not export unmodeled session credentials', () => {
		const libraryWithCredential = { ...library, viewerCode: 'not-for-export' };

		expect(createChallengeLibraryJson(libraryWithCredential)).not.toContain('not-for-export');
	});

	it('loads a whole library from JSON', () => {
		const json = createChallengeLibraryJson(library);

		const parsedLibrary = parseChallengeLibraryJson(json);

		expect(parsedLibrary).toEqual(library);
		expect(parsedLibrary.challenges[0]?.createdAt).toBeInstanceOf(Date);
		expect(parsedLibrary.challenges[0]?.updatedAt).toBeInstanceOf(Date);
	});

	it('preserves reusable character initiative stats in library JSON', () => {
		const libraryWithCharacterStat = {
			...library,
			characters: library.characters.map((character) =>
				character.id === firstCharacterId ? { ...character, initiativeStat: 4 } : character
			)
		};
		const json = createChallengeLibraryJson(libraryWithCharacterStat);

		expect(JSON.parse(json).characters[0].initiativeStat).toBe(4);
		expect(parseChallengeLibraryJson(json).characters).toEqual(libraryWithCharacterStat.characters);
	});

	it('exports a single challenge with only its referenced reusable characters', () => {
		const json = createChallengeJson(library, firstChallengeId);
		const challengeFile = JSON.parse(json);

		expect(challengeFile.challenges[0].createdAt).toBe(
			library.challenges[0]?.createdAt.toISOString()
		);
		expect(challengeFile.characters).toEqual([library.characters[0]]);
		expect(parseChallengeJson(json).challenges).toEqual([library.challenges[0]]);
	});

	it('rejects challenge files containing more than one challenge', () => {
		const json = createChallengeLibraryJson(library);

		expect(() => parseChallengeJson(json)).toThrow(ChallengeJsonFileError);
	});

	it('reports malformed JSON explicitly', () => {
		expect(() => parseChallengeLibraryJson('{')).toThrowError(
			expect.objectContaining({
				code: 'invalid-json'
			})
		);
	});

	it('reports validation issues for malformed library data', () => {
		const invalidJson = JSON.stringify({ formatVersion: 1, characters: null, challenges: [] });

		expect(() => parseChallengeLibraryJson(invalidJson)).toThrowError(
			expect.objectContaining({
				code: 'invalid-library',
				issues: expect.arrayContaining([expect.objectContaining({ path: '$.characters' })])
			})
		);
	});

	it('rejects unsupported format versions without returning data', () => {
		const invalidJson = JSON.stringify({ ...library, formatVersion: 2 });

		expect(() => parseChallengeLibraryJson(invalidJson)).toThrowError(
			expect.objectContaining({
				code: 'unsupported-version',
				issues: [{ path: '$.formatVersion', message: 'Unsupported challenge library version.' }]
			})
		);
	});

	it('reads JSON library files', async () => {
		const file = new File([createChallengeLibraryJson(library)], 'backup.json', {
			type: 'application/json'
		});

		await expect(readChallengeLibraryJsonFile(file)).resolves.toEqual(library);
	});

	it('reads a single challenge JSON file with an explicit complete result', async () => {
		const file = new File([createChallengeJson(library, firstChallengeId)], 'challenge.json', {
			type: 'application/json'
		});

		await expect(readChallengeJsonFile(file)).resolves.toEqual({
			content: {
				formatVersion: 1,
				characters: [library.characters[0]],
				challenges: [library.challenges[0]]
			},
			unreadableFields: [],
			isPartial: false
		});
	});

	it('returns recoverable content and unreadable fields for a partial read', async () => {
		const partialFile = new File(
			[
				JSON.stringify({
					formatVersion: 1,
					characters: [library.characters[0], { id: 'invalid-id', name: 'Broken' }],
					challenges: [library.challenges[0]]
				})
			],
			'challenge.json',
			{ type: 'application/json' }
		);

		await expect(readChallengeJsonFile(partialFile)).resolves.toEqual({
			content: {
				formatVersion: 1,
				characters: [library.characters[0]],
				challenges: [library.challenges[0]]
			},
			unreadableFields: [expect.objectContaining({ path: '$.characters[1].id' })],
			isPartial: true
		});
	});

	it('downloads the challenge as a readable JSON file', () => {
		const createObjectUrl = vi.fn(() => 'blob:challenge');
		const revokeObjectUrl = vi.fn();
		stubObjectUrl(createObjectUrl, revokeObjectUrl);
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

		downloadChallengeJson(library, firstChallengeId);

		expect(createObjectUrl).toHaveBeenCalledOnce();
		expect(click).toHaveBeenCalledOnce();
		expect(revokeObjectUrl).toHaveBeenCalledWith('blob:challenge');
	});

	it('downloads a complete library backup', () => {
		const createObjectUrl = vi.fn(() => 'blob:library');
		const revokeObjectUrl = vi.fn();
		stubObjectUrl(createObjectUrl, revokeObjectUrl);
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

		downloadChallengeLibraryJson(library);

		expect(createObjectUrl).toHaveBeenCalledOnce();
		expect(click).toHaveBeenCalledOnce();
		expect(revokeObjectUrl).toHaveBeenCalledWith('blob:library');
	});

	it('rejects exporting a challenge that does not exist', () => {
		expect(() => createChallengeJson(library, createUuid())).toThrowError(
			expect.objectContaining({ code: 'challenge-not-found' })
		);
	});
});
