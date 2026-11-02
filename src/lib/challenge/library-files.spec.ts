import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createChallengeLibraryJson } from './json-files';
import {
	backupChallengeLibraryToJsonFile,
	restoreChallengeLibraryFromJsonFile
} from './library-files';
import { loadChallengeLibrary, saveChallengeLibrary } from './storage';
import { createUuid } from './uuid';

const DATABASE_NAME = 'soulstone-challenge-library';
const library = { formatVersion: 1 as const, characters: [], challenges: [] };
let indexedDbFactory: IDBFactory;

function deleteDatabase(): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDbFactory.deleteDatabase(DATABASE_NAME);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		request.onblocked = () => reject(new Error('Deleting the test database was blocked.'));
	});
}

function createJsonFile(json: string): File {
	return new File([json], 'backup.json', { type: 'application/json' });
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

describe('library file workflows', () => {
	it('backs up the current database as a downloadable full-library JSON file', async () => {
		await saveChallengeLibrary(library, indexedDbFactory);
		const createObjectUrl = vi.fn(() => 'blob:backup');
		const revokeObjectUrl = vi.fn();
		stubObjectUrl(createObjectUrl, revokeObjectUrl);
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

		await backupChallengeLibraryToJsonFile(indexedDbFactory);

		expect(createObjectUrl).toHaveBeenCalledOnce();
		expect(click).toHaveBeenCalledOnce();
		expect(revokeObjectUrl).toHaveBeenCalledWith('blob:backup');
	});

	it('restores a full library backup and replaces the current database contents', async () => {
		await saveChallengeLibrary(
			{ formatVersion: 1, characters: [{ id: createUuid(), name: 'Existing' }], challenges: [] },
			indexedDbFactory
		);

		await expect(
			restoreChallengeLibraryFromJsonFile(
				createJsonFile(createChallengeLibraryJson(library)),
				indexedDbFactory
			)
		).resolves.toEqual(library);
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(library);
	});

	it('leaves the current database unchanged when a backup file is invalid', async () => {
		await saveChallengeLibrary(library, indexedDbFactory);

		await expect(
			restoreChallengeLibraryFromJsonFile(createJsonFile('{'), indexedDbFactory)
		).rejects.toThrow();
		await expect(loadChallengeLibrary(indexedDbFactory)).resolves.toEqual(library);
	});
});
