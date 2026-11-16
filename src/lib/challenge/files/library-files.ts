import { downloadChallengeLibraryJson } from './json-files';
import { loadChallengeLibrary } from '../storage/storage';

/**
 * Downloads an uncompressed JSON backup of the complete current IndexedDB library.
 * @param indexedDbFactory IndexedDB factory to read from; defaults to the browser's global factory.
 * @returns A promise that resolves after the library has been read and the download initiated.
 * @throws If the stored library cannot be read or the browser cannot download the backup.
 */
export async function backupChallengeLibraryToJsonFile(
	indexedDbFactory: Readonly<IDBFactory> = globalThis.indexedDB
): Promise<void> {
	await downloadChallengeLibraryJson(await loadChallengeLibrary(indexedDbFactory));
}
