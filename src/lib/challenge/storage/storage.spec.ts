import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHALLENGE_FORMAT_VERSION, type Challenge, type ChallengeLibrary } from '../core/model';
import {
	ChallengeLibraryValidationError,
	loadChallengeLibrary,
	loadChallengeLibraryWithDiagnostics,
	saveChallengeLibrary,
	saveChallengesToLibrary,
	saveChallengeToLibrary
} from './storage';
import { createUuid } from '../core/uuid';

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
	it('saves a batch together while retaining existing challenges and unreadable records', async () => {
		await seedStoredLibrary({
			...library,
			challenges: [...library.challenges, { name: 'Broken' }]
		});
		const imported = [createChallenge('First'), createChallenge('Second')];
		await saveChallengesToLibrary(imported, indexedDbFactory);
		const result = await loadChallengeLibraryWithDiagnostics(indexedDbFactory);
		expect(result.library.challenges).toEqual([...library.challenges, ...imported]);
		expect(result.unreadableChallenges[0]?.name).toBe('Broken');
	});

	it('leaves storage unchanged when any challenge in a batch has conflicting identities', async () => {
		await saveChallengeLibrary(library, indexedDbFactory);
		const first = createChallenge('First');
		const second: Challenge = {
			...createChallenge('Second'),
			factions: [{ id: first.id, name: 'Conflict', color: 'blue' }]
		};
		await expect(saveChallengesToLibrary([first, second], indexedDbFactory)).rejects.toBeInstanceOf(
			ChallengeLibraryValidationError
		);
		expect(await loadChallengeLibrary(indexedDbFactory)).toEqual(library);
	});

	it('keeps editable invalid drafts when adding a batch', async () => {
		const draft = { ...createChallenge('Draft'), fairnessWeight: -1 };
		await saveChallengeToLibrary(draft, indexedDbFactory);
		const imported = [createChallenge('First'), createChallenge('Second')];
		await saveChallengesToLibrary(imported, indexedDbFactory);
		expect((await loadChallengeLibrary(indexedDbFactory)).challenges).toEqual([draft, ...imported]);
	});

	it('returns an empty versioned library when none has been saved', async () => {
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(emptyLibrary);
	});

	it('saves and reloads a valid challenge library', async () => {
		await saveChallengeLibrary(library, indexedDbFactory);

		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(library);
	});

	it('saves and reloads unfinished Spawn editing state', async () => {
		const factionId = createUuid();
		const creatureId = createUuid();
		const turnId = createUuid();
		const editing: Challenge = {
			...createChallenge('Editing'),
			factions: [{ id: factionId, name: 'Players', color: 'blue' }],
			creatures: [
				{
					id: creatureId,
					kind: 'character',
					name: 'Aria',
					factionId,
					isHidden: false,
					turns: [{ id: turnId, initiative: { kind: 'roll', mode: 'manual' } }]
				}
			],
			runState: {
				initiativeResults: { [turnId]: 9 },
				generatedTurnOrder: [{ kind: 'spawn' }],
				spawnCount: 1,
				spawnEdit: {
					newCreatureIds: [creatureId],
					newNpcTypeIds: [],
					newTurnIds: [turnId],
					lockedInitiativeTurnIds: [turnId]
				}
			}
		};
		const editingLibrary = { ...emptyLibrary, challenges: [editing] };

		await saveChallengeLibrary(editingLibrary, indexedDbFactory);

		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(editingLibrary);
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

	it('saves a challenge while retaining unreadable existing records', async () => {
		const savedChallenge = createChallenge('Saved');
		const invalidChallenge = { ...createChallenge('Invalid'), creatures: null };
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
		await expect(loadChallengeLibraryWithDiagnostics(indexedDbFactory)).resolves.toMatchObject({
			unreadableChallenges: [
				{ index: 1, name: 'Invalid', issues: [{ path: '$.challenges[1].creatures' }] }
			]
		});
	});

	it('loads healthy challenges independently and reports unreadable entries', async () => {
		await seedStoredLibrary({ ...library, challenges: [null, ...library.challenges] });
		await expect(loadChallengeLibraryWithDiagnostics(indexedDbFactory)).resolves.toMatchObject({
			library,
			unreadableChallenges: [{ index: 0, issues: [{ path: '$.challenges[0]' }] }]
		});
	});

	it('allows creation when all existing challenges are unreadable and retains their diagnostics', async () => {
		await seedStoredLibrary({ ...emptyLibrary, challenges: [null, { name: 'Broken' }] });
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(emptyLibrary);
		const challenge = createChallenge('New');
		await saveChallengeToLibrary(challenge, indexedDbFactory);
		const result = await loadChallengeLibraryWithDiagnostics(indexedDbFactory);
		expect(result.library.challenges).toEqual([challenge]);
		expect(result.unreadableChallenges.map((entry) => entry.index)).toEqual([0, 1]);
		expect(result.unreadableChallenges[1].name).toBe('Broken');
	});

	it('isolates duplicate identities without blocking edits to the readable first copy', async () => {
		const challenge = createChallenge('Duplicate');
		await seedStoredLibrary({ ...emptyLibrary, challenges: [challenge, challenge] });
		const result = await loadChallengeLibraryWithDiagnostics(indexedDbFactory);
		expect(result.library.challenges).toEqual([challenge]);
		expect(result.unreadableChallenges).toMatchObject([
			{ index: 1, issues: [{ path: '$.challenges[1].id' }] }
		]);
		await saveChallengeToLibrary({ ...challenge, name: 'Renamed' }, indexedDbFactory);
		const updated = await loadChallengeLibraryWithDiagnostics(indexedDbFactory);
		expect(updated.library.challenges[0].name).toBe('Renamed');
		expect(updated.unreadableChallenges[0].name).toBe('Duplicate');
	});

	it('does not overwrite an unreadable-only record by ID', async () => {
		const challenge = createChallenge('Unreadable');
		await seedStoredLibrary({ ...emptyLibrary, challenges: [{ ...challenge, creatures: null }] });
		await expect(saveChallengeToLibrary(challenge, indexedDbFactory)).rejects.toBeInstanceOf(
			ChallengeLibraryValidationError
		);
	});

	it('loads and saves a draft with a missing faction reference', async () => {
		const challenge = createChallenge('Missing faction');
		challenge.creatures = [
			{
				id: createUuid(),
				kind: 'character',
				name: 'Hero',
				factionId: createUuid(),
				isHidden: false,
				turns: []
			}
		];
		await saveChallengeToLibrary(challenge, indexedDbFactory);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual({
			...emptyLibrary,
			challenges: [challenge]
		});
	});

	it('removes obsolete relative distance from all turns without assigning sibling indices', async () => {
		const challenge = createChallenge('Legacy');
		const factionId = createUuid();
		const targetTurnId = createUuid();
		const target = { id: targetTurnId, initiative: { kind: 'static' as const, value: 10 } };
		const turns = Array.from({ length: 4 }, () => ({
			id: createUuid(),
			initiative: {
				kind: 'relative-position' as const,
				relation: 'after' as const,
				targetTurnId,
				distance: 1
			}
		}));
		const creature = {
			id: createUuid(),
			kind: 'character' as const,
			name: 'Hero',
			factionId,
			isHidden: false,
			turns: [target, ...turns]
		};
		await seedStoredLibrary({
			...emptyLibrary,
			unused: 'legacy',
			challenges: [
				{
					...challenge,
					factions: [{ id: factionId, name: 'Players', color: 'blue' }],
					creatures: [creature]
				}
			]
		});
		const result = await loadChallengeLibrary(indexedDbFactory);
		expect(result.challenges[0].creatures[0].turns).toEqual([
			target,
			...turns.map((turn) => ({
				id: turn.id,
				initiative: { kind: 'relative-position', relation: 'after', targetTurnId }
			}))
		]);
		expect(result).not.toHaveProperty('unused');
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

	it('saves and reloads a challenge with finite setup-invalid values', async () => {
		const draft = { ...createChallenge('Draft'), fairnessWeight: -1 };

		await saveChallengeToLibrary(draft, indexedDbFactory);

		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual({
			...emptyLibrary,
			challenges: [draft]
		});
	});

	it('preserves numeric setup-invalid values for repair', async () => {
		const invalid = { ...createChallenge('Bad'), fairnessWeight: Number.NaN };

		await saveChallengeToLibrary(invalid, indexedDbFactory);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual({
			...emptyLibrary,
			challenges: [invalid]
		});
	});

	it('isolates data between IndexedDB factories', async () => {
		const otherIndexedDbFactory = new IDBFactory();
		await saveChallengeLibrary(library, indexedDbFactory);

		await expect(loadChallengeLibrary(otherIndexedDbFactory)).resolves.toEqual(emptyLibrary);
	});
});
