import type { ChallengeLibrary } from './model';
import { downloadChallengeLibraryJson, readChallengeLibraryJsonFile } from './json-files';
import { loadChallengeLibrary, saveChallengeLibrary } from './storage';

/** Downloads a JSON backup of the complete current IndexedDB library. */
export async function backupChallengeLibraryToJsonFile(
	indexedDbFactory: Readonly<IDBFactory> = globalThis.indexedDB
): Promise<void> {
	downloadChallengeLibraryJson(await loadChallengeLibrary(indexedDbFactory));
}

/** Replaces the complete IndexedDB library with a validated JSON backup. */
export async function restoreChallengeLibraryFromJsonFile(
	file: Readonly<File>,
	indexedDbFactory: Readonly<IDBFactory> = globalThis.indexedDB
): Promise<ChallengeLibrary> {
	const library = await readChallengeLibraryJsonFile(file);
	await saveChallengeLibrary(library, indexedDbFactory);
	return library;
}
