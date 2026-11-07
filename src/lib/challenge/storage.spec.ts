import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHALLENGE_FORMAT_VERSION, type Challenge, type ChallengeLibrary } from './model';
import {
	ChallengeLibraryValidationError,
	loadChallengeLibrary,
	saveChallengeLibrary,
	saveChallengeToLibrary
} from './storage';
import { createUuid } from './uuid';

const DATABASE_NAME = 'soulstone-challenge-library';
const OBJECT_STORE_NAME = 'challengeLibrary';
const LIBRARY_KEY = 'current';
let indexedDbFactory: IDBFactory;

const emptyLibrary: ChallengeLibrary = {
	formatVersion: CHALLENGE_FORMAT_VERSION,
	challenges: []
};

const library: ChallengeLibrary = {
	...emptyLibrary,
	challenges: [createChallenge('Saved')]
};

function createChallenge(name: string): Challenge {
	const date = new Date('2026-01-01T00:00:00.000Z');
	return {
		id: createUuid(),
		name,
		createdAt: date,
		updatedAt: date,
		factions: [],
		npcTypes: [],
		fairnessWeight: 3,
		creatures: []
	};
}

function deleteDatabase(): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDbFactory.deleteDatabase(DATABASE_NAME);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		request.onblocked = () => reject(new Error('Deleting the test database was blocked.'));
	});
}

async function seedStoredLibrary(value: unknown): Promise<void> {
	const database = await new Promise<IDBDatabase>((resolve, reject) => {
		const request = indexedDbFactory.open(DATABASE_NAME, 1);
		request.onupgradeneeded = () => {
			request.result.createObjectStore(OBJECT_STORE_NAME);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});

	try {
		await new Promise<void>((resolve, reject) => {
			const transaction = database.transaction(OBJECT_STORE_NAME, 'readwrite');
			transaction.objectStore(OBJECT_STORE_NAME).put(value, LIBRARY_KEY);
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
			transaction.onabort = () => reject(transaction.error);
		});
	} finally {
		database.close();
	}
}

beforeEach(async () => {
	indexedDbFactory = new IDBFactory();
	await deleteDatabase();
});

describe('challenge library storage', () => {
	it('returns an empty versioned library when none has been saved', async () => {
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(emptyLibrary);
	});

	it('saves and reloads a valid challenge library', async () => {
		await saveChallengeLibrary(library, indexedDbFactory);

		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(library);
	});

	it('rejects invalid stored data and reports its validation issues', async () => {
		await seedStoredLibrary({ ...library, formatVersion: 2 });

		await expect(loadChallengeLibrary(indexedDbFactory)).rejects.toMatchObject({
			constructor: ChallengeLibraryValidationError,
			issues: [{ path: '$.formatVersion' }]
		});
	});

	it('does not save invalid data', async () => {
		const invalidLibrary = { ...library, formatVersion: 2 };

		await expect(saveChallengeLibrary(invalidLibrary, indexedDbFactory)).rejects.toBeInstanceOf(
			ChallengeLibraryValidationError
		);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(emptyLibrary);
	});

	it('adds a challenge to an empty library', async () => {
		const challenge = createChallenge('First');

		await saveChallengeToLibrary(challenge, indexedDbFactory);

		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual({
			...emptyLibrary,
			challenges: [challenge]
		});
	});

	it('saves a challenge while skipping invalid existing challenges', async () => {
		const savedChallenge = createChallenge('Saved');
		const invalidChallenge = { ...createChallenge('Invalid'), fairnessWeight: -1 };
		const newChallenge = createChallenge('New');
		await seedStoredLibrary({
			...emptyLibrary,
			challenges: [savedChallenge, invalidChallenge]
		});

		await saveChallengeToLibrary(newChallenge, indexedDbFactory);

		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual({
			...emptyLibrary,
			challenges: [savedChallenge, newChallenge]
		});
	});

	it('replaces a saved challenge by ID, keeping others', async () => {
		const first = createChallenge('First');
		const second = createChallenge('Second');
		await saveChallengeToLibrary(first, indexedDbFactory);
		await saveChallengeToLibrary(second, indexedDbFactory);

		const renamedFirst = { ...first, name: 'Renamed' };
		await saveChallengeToLibrary(renamedFirst, indexedDbFactory);

		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual({
			...emptyLibrary,
			challenges: [renamedFirst, second]
		});
	});

	it('does not save an invalid challenge', async () => {
		const invalid = { ...createChallenge('Bad'), fairnessWeight: -1 };

		await expect(saveChallengeToLibrary(invalid, indexedDbFactory)).rejects.toBeInstanceOf(
			ChallengeLibraryValidationError
		);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(emptyLibrary);
	});

	it('isolates data between IndexedDB factories', async () => {
		const otherIndexedDbFactory = new IDBFactory();
		await saveChallengeLibrary(library, indexedDbFactory);

		await expect(loadChallengeLibrary(otherIndexedDbFactory)).resolves.toEqual(emptyLibrary);
	});
});
