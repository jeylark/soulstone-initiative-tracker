import { CHALLENGE_FORMAT_VERSION, type Challenge, type ChallengeLibrary } from '../core/model';
import type { DeepReadonly } from '../../DeepReadonly';
import {
	validateChallengeLibrary,
	validateReadableChallengeLibrary,
	type ValidationIssue
} from '../core/validation';
import { sanitizeChallengeLibraryData } from '../core/raw-sanitizer';

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

async function readStoredLibraryValue(
	indexedDbFactory: Readonly<IDBFactory>
): Promise<Readonly<{ hasValue: boolean; value: unknown }>> {
	const database = await openDatabase(indexedDbFactory);
	try {
		return await new Promise((resolve, reject) => {
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
		});
	} finally {
		database.close();
	}
}

/** An unreadable challenge retained in browser storage but excluded from the editable library. */
export interface UnreadableChallenge {
	/** Original zero-based position in the saved library. */
	readonly index: number;
	/** Saved challenge name when it is a string, including an empty draft name. */
	readonly name?: string;
	/** Saved challenge identifier when it is a string. */
	readonly id?: string;
	/** Structural issues with paths referring to the original saved positions. */
	readonly issues: readonly ValidationIssue[];
}

/** Browser-library recovery result, separating editable records from unreadable diagnostics. */
export interface ChallengeLibraryLoadResult {
	/** Sanitized readable challenges, including those with repairable Setup errors. */
	readonly library: ChallengeLibrary;
	/** Unreadable records that remain stored until explicitly replaced by a whole-library operation. */
	readonly unreadableChallenges: readonly UnreadableChallenge[];
}

function getStoredChallenges(value: unknown): readonly unknown[] {
	const record =
		typeof value === 'object' && value !== null && !Array.isArray(value)
			? (value as Readonly<Record<string, unknown>>)
			: undefined;
	const result = validateReadableChallengeLibrary({
		formatVersion: record?.formatVersion,
		challenges: []
	});
	if (!result.isValid) throw new ChallengeLibraryValidationError(result.issues);
	if (!Array.isArray(record?.challenges)) {
		throw new ChallengeLibraryValidationError([
			{ path: '$.challenges', message: 'Expected an array.' }
		]);
	}
	return Array.from(record.challenges);
}

function recoverLibrary(value: unknown): ChallengeLibraryLoadResult {
	const savedChallenges = getStoredChallenges(value);
	const unreadableChallenges: UnreadableChallenge[] = [];
	let library = createEmptyChallengeLibrary();
	for (const [index, challenge] of savedChallenges.entries()) {
		const candidateIndex = library.challenges.length;
		const candidate = sanitizeChallengeLibraryData({
			formatVersion: CHALLENGE_FORMAT_VERSION,
			challenges: [challenge]
		});
		const sanitized = (candidate as Readonly<{ challenges: readonly unknown[] }>).challenges[0];
		const result = validateReadableChallengeLibrary({
			...library,
			challenges: [...library.challenges, sanitized]
		});
		if (result.isValid) {
			library = result.value;
		} else {
			const record =
				typeof challenge === 'object' && challenge !== null
					? (challenge as Readonly<Record<string, unknown>>)
					: undefined;
			unreadableChallenges.push({
				index,
				...(typeof record?.name === 'string' ? { name: record.name } : {}),
				...(typeof record?.id === 'string' ? { id: record.id } : {}),
				issues: result.issues.map((issue) => ({
					...issue,
					path: issue.path.replace(`$.challenges[${candidateIndex}]`, `$.challenges[${index}]`)
				}))
			});
		}
	}
	return { library, unreadableChallenges };
}

/**
 * Loads readable saved challenges independently and reports unreadable records without deleting them.
 * @param indexedDbFactory IndexedDB factory used for storage; defaults to the browser's global factory.
 * @returns Sanitized editable library and original-index diagnostics for unreadable challenges.
 * @throws {ChallengeLibraryStorageError} If IndexedDB cannot be accessed.
 * @throws {ChallengeLibraryValidationError} If the library envelope is malformed or its version unsupported.
 */
export async function loadChallengeLibraryWithDiagnostics(
	indexedDbFactory: Readonly<IDBFactory> = globalThis.indexedDB
): Promise<ChallengeLibraryLoadResult> {
	const storedLibrary = await readStoredLibraryValue(indexedDbFactory);
	return storedLibrary.hasValue
		? recoverLibrary(storedLibrary.value)
		: { library: createEmptyChallengeLibrary(), unreadableChallenges: [] };
}

/**
 * Loads sanitized readable saved challenges, including drafts with Setup errors.
 * @param indexedDbFactory IndexedDB factory used for storage; defaults to the browser's global factory.
 * @returns The editable library, omitting unreadable entries; use the diagnostic loader to report them.
 * @throws {ChallengeLibraryStorageError} If IndexedDB cannot be opened, read, or closed successfully.
 * @throws {ChallengeLibraryValidationError} If the library envelope is malformed or its version unsupported.
 */
export async function loadChallengeLibrary(
	indexedDbFactory: Readonly<IDBFactory> = globalThis.indexedDB
): Promise<ChallengeLibrary> {
	return (await loadChallengeLibraryWithDiagnostics(indexedDbFactory)).library;
}

/**
 * Validates and saves the supplied challenge library, replacing the stored library.
 * @param value Candidate library data to validate and persist.
 * @param indexedDbFactory IndexedDB factory used for storage; defaults to the browser's global factory.
 * @returns A promise that resolves when the replacement library has been saved.
 * @throws {ChallengeLibraryValidationError} If `value` does not match the library schema.
 * @throws {ChallengeLibraryStorageError} If IndexedDB cannot be opened or the write fails.
 */
export async function saveChallengeLibrary(
	value: unknown,
	indexedDbFactory: Readonly<IDBFactory> = globalThis.indexedDB
): Promise<void> {
	const result = validateChallengeLibrary(value);
	if (!result.isValid) throw new ChallengeLibraryValidationError(result.issues);
	await writeStoredLibrary(result.value, indexedDbFactory);
}

async function writeStoredLibrary(
	value: unknown,
	indexedDbFactory: Readonly<IDBFactory>
): Promise<void> {
	const database = await openDatabase(indexedDbFactory);
	try {
		await new Promise<void>((resolve, reject) => {
			const transaction = database.transaction(OBJECT_STORE_NAME, 'readwrite');
			const request = transaction.objectStore(OBJECT_STORE_NAME).put(value, LIBRARY_KEY);
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

/**
 * Saves a challenge into the stored library, replacing any challenge with the same ID.
 * Setup-invalid drafts can be saved; unreadable existing records are retained unchanged.
 * @param challenge Challenge to add or replace.
 * @param indexedDbFactory IndexedDB factory used for storage; defaults to the browser's global factory.
 * @returns A promise that resolves when the updated library has been saved.
 * @throws {ChallengeLibraryValidationError} If the challenge is unreadable, identities conflict, or the saved envelope is unsupported.
 * @throws {ChallengeLibraryStorageError} If IndexedDB cannot be opened, read, or written.
 */
export async function saveChallengeToLibrary(
	challenge: DeepReadonly<Challenge>,
	indexedDbFactory: Readonly<IDBFactory> = globalThis.indexedDB
): Promise<void> {
	await saveChallengesToLibrary([challenge], indexedDbFactory);
}

/**
 * Saves a batch of challenges in one write, replacing readable challenges with matching IDs.
 * Unrelated challenges, editable drafts, and unreadable raw records are preserved.
 * @param challenges Challenges to add or replace; all must have distinct identities.
 * @param indexedDbFactory IndexedDB factory used for storage; defaults to the browser's global factory.
 * @returns A promise that resolves after the entire batch has been saved.
 * @throws {ChallengeLibraryValidationError} If any challenge is unreadable, identities conflict, or the stored envelope is unsupported.
 * @throws {ChallengeLibraryStorageError} If storage cannot be accessed or the batch write fails.
 */
export async function saveChallengesToLibrary(
	challenges: DeepReadonly<readonly Challenge[]>,
	indexedDbFactory: Readonly<IDBFactory> = globalThis.indexedDB
): Promise<void> {
	const storedLibrary = await readStoredLibraryValue(indexedDbFactory);
	const rawChallenges = storedLibrary.hasValue ? getStoredChallenges(storedLibrary.value) : [];
	const recovery = storedLibrary.hasValue
		? recoverLibrary(storedLibrary.value)
		: { library: createEmptyChallengeLibrary(), unreadableChallenges: [] };
	const ids = new Set(challenges.map(({ id }) => id.toLowerCase()));
	if (
		recovery.unreadableChallenges.some(
			(entry) =>
				entry.id !== undefined &&
				ids.has(entry.id.toLowerCase()) &&
				!recovery.library.challenges.some(
					(saved) => saved.id.toLowerCase() === entry.id?.toLowerCase()
				)
		)
	) {
		throw new ChallengeLibraryValidationError([
			{ path: '$.id', message: 'An unreadable saved challenge already uses this identifier.' }
		]);
	}
	const result = validateReadableChallengeLibrary(
		sanitizeChallengeLibraryData({
			formatVersion: CHALLENGE_FORMAT_VERSION,
			challenges: [
				...recovery.library.challenges.filter((saved) => !ids.has(saved.id.toLowerCase())),
				...challenges
			]
		})
	);
	if (!result.isValid) throw new ChallengeLibraryValidationError(result.issues);
	const readableById = new Map(
		result.value.challenges.map((saved) => [saved.id.toLowerCase(), saved])
	);
	const unreadableIndices = new Set(recovery.unreadableChallenges.map((entry) => entry.index));
	const retainedIds = new Set<string>();
	const mergedChallenges = rawChallenges.map((saved, index) => {
		if (unreadableIndices.has(index)) return saved;
		const savedId = (saved as Readonly<Challenge>).id.toLowerCase();
		retainedIds.add(savedId);
		return readableById.get(savedId);
	});
	for (const id of ids) {
		if (!retainedIds.has(id)) mergedChallenges.push(readableById.get(id));
	}
	await writeStoredLibrary(
		{ formatVersion: CHALLENGE_FORMAT_VERSION, challenges: mergedChallenges },
		indexedDbFactory
	);
}
