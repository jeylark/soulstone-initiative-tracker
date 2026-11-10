import type { DeepReadonly } from '#lib';
import type { Challenge, ViewerTurnOrderDisplayItem } from '#lib/challenge';

const DATABASE_NAME = 'soulstone-live-session-credentials';
const DATABASE_VERSION = 1;
const OBJECT_STORE_NAME = 'credentials';

type CredentialStorageOperation =
	| Readonly<{ kind: 'get'; challengeId: string }>
	| Readonly<{ kind: 'save'; credential: DeepReadonly<LiveSessionCredential> }>
	| Readonly<{ kind: 'delete'; challengeId: string }>;

/** DM reconnect information kept separately from the saved challenge library. */
export interface LiveSessionCredential {
	/** Challenge associated with the active session. */
	challengeId: string;
	/** Server identifier for the active session. */
	sessionId: string;
	/** Secret bearer token used only to resume DM access. */
	reconnectToken: string;
}

/** Public session information returned to the DM interface. */
export interface LiveSessionDescriptor {
	/** Server identifier for the active session. */
	id: string;
	/** Viewer code that read-only guests can use to join. */
	viewerCode: string;
}

/** Session details and visible turn order returned to a read-only viewer. */
export interface LiveViewerSession {
	/** Public details for the active session. */
	session: LiveSessionDescriptor;
	/** Challenge title shown above the viewer's turn order. */
	challengeName: string;
	/** Visible turns and Spawn in generated order. */
	turnOrder: readonly ViewerTurnOrderDisplayItem[];
}

/** Error returned by the live-session API, including its HTTP status. */
export class LiveSessionRequestError extends Error {
	/** HTTP status returned by the server. */
	readonly status: number;

	/**
	 * @param status HTTP status returned by the server.
	 * @param message Explanation returned by the API or a safe fallback.
	 */
	constructor(status: number, message: string) {
		super(message);
		this.name = 'LiveSessionRequestError';
		this.status = status;
	}
}

/** Failure to read or update DM reconnect credentials in IndexedDB. */
export class LiveSessionCredentialStorageError extends Error {
	/**
	 * @param message Human-readable description of the storage failure.
	 */
	constructor(message: string) {
		super(message);
		this.name = 'LiveSessionCredentialStorageError';
	}
}

function openDatabase(indexedDbFactory: Readonly<IDBFactory>): Promise<IDBDatabase> {
	if (!indexedDbFactory) {
		return Promise.reject(
			new LiveSessionCredentialStorageError('IndexedDB is not available for session credentials.')
		);
	}

	return new Promise((resolve, reject) => {
		const request = indexedDbFactory.open(DATABASE_NAME, DATABASE_VERSION);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(OBJECT_STORE_NAME)) {
				request.result.createObjectStore(OBJECT_STORE_NAME, { keyPath: 'challengeId' });
			}
		};
		request.onsuccess = () => {
			const database = request.result;
			database.onversionchange = () => database.close();
			resolve(database);
		};
		request.onerror = () => {
			reject(new LiveSessionCredentialStorageError('Unable to open session credential storage.'));
		};
		request.onblocked = () => {
			reject(
				new LiveSessionCredentialStorageError('Opening session credential storage was blocked.')
			);
		};
	});
}

function withObjectStore(
	indexedDbFactory: Readonly<IDBFactory>,
	mode: IDBTransactionMode,
	storageOperation: CredentialStorageOperation,
	operation: string
): Promise<unknown> {
	return openDatabase(indexedDbFactory).then(
		(database) =>
			new Promise<unknown>((resolve, reject) => {
				const transaction = database.transaction(OBJECT_STORE_NAME, mode);
				const objectStore = transaction.objectStore(OBJECT_STORE_NAME);
				const request =
					storageOperation.kind === 'get'
						? objectStore.get(storageOperation.challengeId)
						: storageOperation.kind === 'save'
							? objectStore.put(storageOperation.credential)
							: objectStore.delete(storageOperation.challengeId);
				let result: unknown;
				request.onsuccess = () => {
					result = request.result;
				};
				transaction.oncomplete = () => {
					database.close();
					resolve(result);
				};
				transaction.onerror = () => {
					database.close();
					reject(new LiveSessionCredentialStorageError(`Unable to ${operation}.`));
				};
				transaction.onabort = () => {
					database.close();
					reject(new LiveSessionCredentialStorageError(`${operation} was aborted.`));
				};
			})
	);
}

/**
 * Loads the reconnect credential for a challenge, if one has been saved.
 *
 * @param challengeId Challenge identifier used as the credential key.
 * @param indexedDbFactory IndexedDB factory; defaults to the browser's global factory.
 * @returns The stored credential, or `undefined` if none exists.
 * @throws {LiveSessionCredentialStorageError} If credential storage cannot be read.
 */
export async function loadLiveSessionCredential(
	challengeId: string,
	indexedDbFactory: Readonly<IDBFactory> = globalThis.indexedDB
): Promise<LiveSessionCredential | undefined> {
	const result = await withObjectStore(
		indexedDbFactory,
		'readonly',
		{ kind: 'get', challengeId },
		'read session credentials'
	);
	if (result === undefined) return undefined;
	if (
		typeof result !== 'object' ||
		result === null ||
		!('challengeId' in result) ||
		!('sessionId' in result) ||
		!('reconnectToken' in result) ||
		typeof result.challengeId !== 'string' ||
		typeof result.sessionId !== 'string' ||
		typeof result.reconnectToken !== 'string'
	) {
		throw new LiveSessionCredentialStorageError('Saved session credentials are invalid.');
	}
	return {
		challengeId: result.challengeId,
		sessionId: result.sessionId,
		reconnectToken: result.reconnectToken
	};
}

/**
 * Saves DM reconnect information separately from the challenge library.
 *
 * @param credential Session identifier, challenge identifier, and reconnect token.
 * @param indexedDbFactory IndexedDB factory; defaults to the browser's global factory.
 * @returns A promise that resolves after the credential has been stored.
 * @throws {LiveSessionCredentialStorageError} If credential storage cannot be updated.
 */
export async function saveLiveSessionCredential(
	credential: DeepReadonly<LiveSessionCredential>,
	indexedDbFactory: Readonly<IDBFactory> = globalThis.indexedDB
): Promise<void> {
	await withObjectStore(
		indexedDbFactory,
		'readwrite',
		{ kind: 'save', credential },
		'save session credentials'
	);
}

/**
 * Removes the saved DM reconnect information for a challenge.
 *
 * @param challengeId Challenge identifier used as the credential key.
 * @param indexedDbFactory IndexedDB factory; defaults to the browser's global factory.
 * @returns A promise that resolves after the credential has been removed.
 * @throws {LiveSessionCredentialStorageError} If credential storage cannot be updated.
 */
export async function deleteLiveSessionCredential(
	challengeId: string,
	indexedDbFactory: Readonly<IDBFactory> = globalThis.indexedDB
): Promise<void> {
	await withObjectStore(
		indexedDbFactory,
		'readwrite',
		{ kind: 'delete', challengeId },
		'remove session credentials'
	);
}

async function readApiResponse(response: Readonly<Response>): Promise<unknown> {
	let body: unknown;
	try {
		body = await response.json();
	} catch {
		throw new LiveSessionRequestError(response.status, 'The server returned an invalid response.');
	}

	if (!response.ok) {
		const message =
			typeof body === 'object' &&
			body !== null &&
			'message' in body &&
			typeof body.message === 'string'
				? body.message
				: 'The live session request failed.';
		throw new LiveSessionRequestError(response.status, message);
	}
	return body;
}

function getSessionDescriptor(value: unknown): LiveSessionDescriptor {
	if (
		typeof value !== 'object' ||
		value === null ||
		!('id' in value) ||
		!('viewerCode' in value) ||
		typeof value.id !== 'string' ||
		typeof value.viewerCode !== 'string'
	) {
		throw new LiveSessionRequestError(502, 'The server returned invalid session details.');
	}
	return { id: value.id, viewerCode: value.viewerCode };
}

/**
 * Creates a server session from the current challenge snapshot.
 *
 * @param challenge Challenge snapshot to project into the read-only viewer's display data.
 * @returns Public session details and the reconnect token, which must be persisted separately.
 * @throws {LiveSessionRequestError} If the server refuses or malforms the request.
 */
export async function createLiveSession(
	challenge: DeepReadonly<Challenge>
): Promise<Readonly<{ session: LiveSessionDescriptor; reconnectToken: string }>> {
	const response = await fetch('/api/sessions', {
		method: 'POST',
		headers: new Headers([['content-type', 'application/json']]),
		body: JSON.stringify({ challenge })
	});
	const body = await readApiResponse(response);
	if (
		typeof body !== 'object' ||
		body === null ||
		!('session' in body) ||
		!('reconnectToken' in body) ||
		typeof body.reconnectToken !== 'string'
	) {
		throw new LiveSessionRequestError(502, 'The server returned invalid session details.');
	}
	return {
		session: getSessionDescriptor(body.session),
		reconnectToken: body.reconnectToken
	};
}

/**
 * Looks up an active live session using its viewer code.
 *
 * @param viewerCode Four- or eight-character code supplied by the viewer.
 * @returns Public session details and its minimal viewer-safe turn order.
 * @throws {LiveSessionRequestError} If the code is inactive or the response is invalid.
 */
export async function joinLiveSession(viewerCode: string): Promise<LiveViewerSession> {
	const response = await fetch('/api/sessions/join', {
		method: 'POST',
		headers: new Headers([['content-type', 'application/json']]),
		body: JSON.stringify({ viewerCode })
	});
	const body = await readApiResponse(response);
	if (
		typeof body !== 'object' ||
		body === null ||
		!('session' in body) ||
		!('challengeName' in body) ||
		!('turnOrder' in body) ||
		typeof body.challengeName !== 'string' ||
		!Array.isArray(body.turnOrder)
	) {
		throw new LiveSessionRequestError(502, 'The server returned invalid session details.');
	}
	return {
		session: getSessionDescriptor(body.session),
		challengeName: body.challengeName,
		turnOrder: body.turnOrder as ViewerTurnOrderDisplayItem[]
	};
}

/**
 * Reconnects to an active session using its saved DM credential.
 *
 * @param credential Session identifier and reconnect token.
 * @returns Public details for the resumed session.
 * @throws {LiveSessionRequestError} If the session is missing, credentials are rejected, or the response is invalid.
 */
export async function resumeLiveSession(
	credential: DeepReadonly<LiveSessionCredential>,
	challenge: DeepReadonly<Challenge>
): Promise<LiveSessionDescriptor> {
	return updateLiveSession(credential, challenge);
}

/**
 * Sends the latest challenge snapshot to an active live session.
 *
 * @param credential Session identifier and reconnect token.
 * @param challenge Latest challenge snapshot to publish.
 * @returns Public details for the active session.
 * @throws {LiveSessionRequestError} If the session is missing, credentials are rejected, or the response is invalid.
 */
export async function updateLiveSession(
	credential: DeepReadonly<LiveSessionCredential>,
	challenge: DeepReadonly<Challenge>
): Promise<LiveSessionDescriptor> {
	const response = await fetch(`/api/sessions/${encodeURIComponent(credential.sessionId)}`, {
		method: 'PUT',
		headers: new Headers([
			['authorization', `Bearer ${credential.reconnectToken}`],
			['content-type', 'application/json']
		]),
		body: JSON.stringify({ challenge })
	});
	const body = await readApiResponse(response);
	if (typeof body !== 'object' || body === null || !('session' in body)) {
		throw new LiveSessionRequestError(502, 'The server returned invalid session details.');
	}
	return getSessionDescriptor(body.session);
}

/**
 * Regenerates the viewer code for an active session.
 *
 * @param credential Session identifier and reconnect token.
 * @returns Public details for the session with its new viewer code.
 * @throws {LiveSessionRequestError} If the session is missing, credentials are rejected, or the response is invalid.
 */
export async function regenerateViewerCode(
	credential: DeepReadonly<LiveSessionCredential>
): Promise<LiveSessionDescriptor> {
	const response = await fetch(
		`/api/sessions/${encodeURIComponent(credential.sessionId)}/viewer-code`,
		{
			method: 'POST',
			headers: new Headers([['authorization', `Bearer ${credential.reconnectToken}`]])
		}
	);
	const body = await readApiResponse(response);
	if (typeof body !== 'object' || body === null || !('session' in body)) {
		throw new LiveSessionRequestError(502, 'The server returned invalid session details.');
	}
	return getSessionDescriptor(body.session);
}

/**
 * Ends a live session using its saved DM reconnect credential.
 *
 * An already-missing session is treated as ended so stale credentials can be cleared after a server
 * restart.
 *
 * @param credential Session identifier and reconnect token.
 * @returns A promise that resolves when the session is ended or already missing.
 * @throws {LiveSessionRequestError} If the server refuses the request or returns an invalid response.
 */
export async function endLiveSession(
	credential: DeepReadonly<LiveSessionCredential>
): Promise<void> {
	const response = await fetch(`/api/sessions/${encodeURIComponent(credential.sessionId)}`, {
		method: 'DELETE',
		headers: new Headers([['authorization', `Bearer ${credential.reconnectToken}`]])
	});
	if (response.status === 204 || response.status === 404) return;
	await readApiResponse(response);
}
