import { CHALLENGE_FORMAT_VERSION, type ChallengeLibrary } from './model';
import { validateChallengeLibrary, type ValidationIssue } from './validation';

const DATABASE_NAME = 'soulstone-challenge-library';
const DATABASE_VERSION = 1;
const OBJECT_STORE_NAME = 'challengeLibrary';
const LIBRARY_KEY = 'current';

/** Invalid challenge-library data found at the persistence boundary. */
export class ChallengeLibraryValidationError extends Error {
	/** Detailed paths and reasons the supplied or stored library failed validation. */
	readonly issues: readonly ValidationIssue[];

	/**
	 * @param issues Validation issues associated with the invalid library.
	 */
	constructor(issues: readonly ValidationIssue[]) {
		super('Challenge library data is invalid.');
		this.name = 'ChallengeLibraryValidationError';
		this.issues = [...issues];
	}
}

/** Failure to access or update browser challenge-library storage. */
export class ChallengeLibraryStorageError extends Error {
	/** Underlying IndexedDB exception, when the browser provided one. */
	readonly cause: DOMException | null;

	/**
	 * @param message Human-readable description of the storage failure.
	 * @param cause Underlying IndexedDB exception, if available.
	 */
	constructor(message: string, cause: DOMException | null = null) {
		super(message);
		this.name = 'ChallengeLibraryStorageError';
		this.cause = cause;
	}
}

function createEmptyChallengeLibrary(): ChallengeLibrary {
	return {
		formatVersion: CHALLENGE_FORMAT_VERSION,
		characters: [],
		challenges: []
	};
}

function openDatabase(indexedDbFactory: Readonly<IDBFactory>): Promise<IDBDatabase> {
	if (!indexedDbFactory) {
		return Promise.reject(new ChallengeLibraryStorageError('IndexedDB is not available.'));
	}

	return new Promise((resolve, reject) => {
		const request = indexedDbFactory.open(DATABASE_NAME, DATABASE_VERSION);
		let isSettled = false;

		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(OBJECT_STORE_NAME)) {
				request.result.createObjectStore(OBJECT_STORE_NAME);
			}
		};
		request.onsuccess = () => {
			const database = request.result;
			if (isSettled) {
				database.close();
				return;
			}
			isSettled = true;
			database.onversionchange = () => database.close();
			resolve(database);
		};
		request.onerror = () => {
			if (isSettled) return;
			isSettled = true;
			reject(
				new ChallengeLibraryStorageError('Unable to open challenge library storage.', request.error)
			);
		};
		request.onblocked = () => {
			if (isSettled) return;
			isSettled = true;
			reject(new ChallengeLibraryStorageError('Opening challenge library storage was blocked.'));
		};
	});
}

/**
 * Loads and validates the saved challenge library, or returns an empty one.
 * @param indexedDbFactory IndexedDB factory used for storage; defaults to the browser's global factory.
 * @returns The stored, validated library, or an empty library when nothing has been saved.
 * @throws {ChallengeLibraryStorageError} If IndexedDB cannot be opened, read, or closed successfully.
 * @throws {ChallengeLibraryValidationError} If stored data does not match the library schema.
 */
export async function loadChallengeLibrary(
	indexedDbFactory: Readonly<IDBFactory> = globalThis.indexedDB
): Promise<ChallengeLibrary> {
	const database = await openDatabase(indexedDbFactory);
	try {
		const storedLibrary = await new Promise<Readonly<{ hasValue: boolean; value: unknown }>>(
			(resolve, reject) => {
				const transaction = database.transaction(OBJECT_STORE_NAME, 'readonly');
				const objectStore = transaction.objectStore(OBJECT_STORE_NAME);
				let hasValue = false;
				let value: unknown;

				const keyRequest = objectStore.getKey(LIBRARY_KEY);
				keyRequest.onsuccess = () => {
					if (keyRequest.result === undefined) return;

					const valueRequest = objectStore.get(LIBRARY_KEY);
					valueRequest.onsuccess = () => {
						hasValue = true;
						value = valueRequest.result;
					};
					valueRequest.onerror = () => {
						reject(
							new ChallengeLibraryStorageError(
								'Unable to read the challenge library.',
								valueRequest.error
							)
						);
					};
				};
				keyRequest.onerror = () => {
					reject(
						new ChallengeLibraryStorageError(
							'Unable to read the challenge library.',
							keyRequest.error
						)
					);
				};
				transaction.oncomplete = () => resolve({ hasValue, value });
				transaction.onerror = () => {
					reject(
						new ChallengeLibraryStorageError(
							'Unable to read the challenge library.',
							transaction.error
						)
					);
				};
				transaction.onabort = () => {
					reject(
						new ChallengeLibraryStorageError(
							'Reading the challenge library was aborted.',
							transaction.error
						)
					);
				};
			}
		);
		if (!storedLibrary.hasValue) return createEmptyChallengeLibrary();

		const result = validateChallengeLibrary(storedLibrary.value);
		if (!result.isValid) throw new ChallengeLibraryValidationError(result.issues);
		return result.value;
	} finally {
		database.close();
	}
}

/**
 * Validates and saves the supplied challenge library, replacing the stored library.
 * @param value Candidate library data to validate and persist.
 * @param indexedDbFactory IndexedDB factory used for storage; defaults to the browser's global factory.
 * @throws {ChallengeLibraryValidationError} If `value` does not match the library schema.
 * @throws {ChallengeLibraryStorageError} If IndexedDB cannot be opened or the write fails.
 */
export async function saveChallengeLibrary(
	value: unknown,
	indexedDbFactory: Readonly<IDBFactory> = globalThis.indexedDB
): Promise<void> {
	const result = validateChallengeLibrary(value);
	if (!result.isValid) throw new ChallengeLibraryValidationError(result.issues);

	const database = await openDatabase(indexedDbFactory);
	try {
		await new Promise<void>((resolve, reject) => {
			const transaction = database.transaction(OBJECT_STORE_NAME, 'readwrite');
			const request = transaction.objectStore(OBJECT_STORE_NAME).put(result.value, LIBRARY_KEY);
			request.onerror = () => {
				reject(
					new ChallengeLibraryStorageError('Unable to save the challenge library.', request.error)
				);
			};
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => {
				reject(
					new ChallengeLibraryStorageError(
						'Unable to save the challenge library.',
						transaction.error
					)
				);
			};
			transaction.onabort = () => {
				reject(
					new ChallengeLibraryStorageError(
						'Saving the challenge library was aborted.',
						transaction.error
					)
				);
			};
		});
	} finally {
		database.close();
	}
}
