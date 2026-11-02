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
		factions: [{ id: factionId, name: 'Adventurers' }],
		npcTypes: [],
		initiativeRollModes: { characters: 'manual', npcs: 'app' },
		creatures: [
			{
				id: createUuid(),
				kind: 'character',
				characterId,
				factionId,
				turns: [{ id: turnId, isHidden: false, initiative: { kind: 'roll' } }]
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
		expect(JSON.parse(json)).toEqual(library);
	});

	it('does not export unmodeled session credentials', () => {
		const libraryWithCredential = { ...library, viewerCode: 'not-for-export' };

		expect(createChallengeLibraryJson(libraryWithCredential)).not.toContain('not-for-export');
	});

	it('loads a whole library from JSON', () => {
		const json = createChallengeLibraryJson(library);

		expect(parseChallengeLibraryJson(json)).toEqual(library);
	});

	it('exports a single challenge with only its referenced reusable characters', () => {
		const json = createChallengeJson(library, firstChallengeId);
		const challengeFile = JSON.parse(json) as ChallengeLibrary;

		expect(challengeFile.challenges).toEqual([library.challenges[0]]);
		expect(challengeFile.characters).toEqual([library.characters[0]]);
		expect(parseChallengeJson(json)).toEqual(challengeFile);
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

	it('reads a single challenge JSON file', async () => {
		const file = new File([createChallengeJson(library, firstChallengeId)], 'challenge.json', {
			type: 'application/json'
		});

		await expect(readChallengeJsonFile(file)).resolves.toEqual({
			formatVersion: 1,
			characters: [library.characters[0]],
			challenges: [library.challenges[0]]
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
