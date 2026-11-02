import { downloadChallengeLibraryJson } from './json-files';
import { loadChallengeLibrary } from './storage';

/** Downloads a JSON backup of the complete current IndexedDB library. */
export async function backupChallengeLibraryToJsonFile(
	indexedDbFactory: Readonly<IDBFactory> = globalThis.indexedDB
): Promise<void> {
	downloadChallengeLibraryJson(await loadChallengeLibrary(indexedDbFactory));
}
