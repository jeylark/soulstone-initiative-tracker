import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import type { DeepReadonly } from '../DeepReadonly';
import {
	validateChallengeLibrary,
	type Challenge,
	type ValidationIssue,
	type ViewerTurnOrderDisplayItem
} from '../challenge';
import { loadServerConfig } from './server-config';
import { createViewerTurnOrder } from './viewer-turn-order';

const VIEWER_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const VIEWER_CODE_LENGTH = 4;
const DEFAULT_MAX_VIEWER_CONNECTIONS_PER_SESSION = 100;
const DEFAULT_SESSION_INACTIVITY_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;

type LiveSessionUpdateListener = (session: Readonly<LiveSession> | undefined) => void;

type SessionExpiration = Readonly<{
	lastDmActivityAt: number;
	timer: ReturnType<typeof setTimeout>;
}>;

/** Minimal snapshot needed to render the read-only viewer. */
export interface LiveSession {
	/** Unique identifier used to end the session. */
	id: string;
	/** Code viewers can use to find this session. */
	viewerCode: string;
	/** Challenge title shown above the viewer's turn order. */
	challengeName: string;
	/** Visible turn cards and Spawn entry; challenge data is not retained. */
	turnOrder: readonly ViewerTurnOrderDisplayItem[];
}

/** A newly created session and its one-time DM reconnect credential. */
export interface CreatedLiveSession {
	/** Session details that can be shared with viewers. */
	session: LiveSession;
	/** Secret required to resume DM access; store it separately from challenge data. */
	reconnectToken: string;
}

/** Result of validating a challenge received by the live-session API. */
export type LiveSessionChallengeResult =
	| Readonly<{ isValid: true; challenge: Challenge }>
	| Readonly<{ isValid: false; issues: readonly ValidationIssue[] }>;

/** Thrown when creating a session would exceed the registry's configured capacity. */
export class LiveSessionLimitError extends Error {
	constructor() {
		super('The server has reached its active session limit.');
		this.name = 'LiveSessionLimitError';
	}
}

/** Thrown when a session exists but the supplied DM reconnect credential is invalid. */
export class LiveSessionAuthorizationError extends Error {
	constructor() {
		super('The reconnect credential is invalid.');
		this.name = 'LiveSessionAuthorizationError';
	}
}

/** Thrown when trying to resume a session that is no longer active. */
export class LiveSessionNotFoundError extends Error {
	constructor() {
		super('The live session is no longer active.');
		this.name = 'LiveSessionNotFoundError';
	}
}

/** Thrown when a session already has its configured number of viewer connections. */
export class LiveSessionViewerLimitError extends Error {
	constructor() {
		super('This live session has reached its viewer connection limit.');
		this.name = 'LiveSessionViewerLimitError';
	}
}

/**
 * Parses and validates a challenge snapshot received as JSON.
 *
 * @param value Untrusted challenge data, with dates serialized as ISO strings.
 * @returns A validated challenge with `Date` instances, or all validation issues.
 */
export function validateLiveSessionChallenge(value: unknown): LiveSessionChallengeResult {
	if (!isRecord(value)) {
		return {
			isValid: false,
			issues: [{ path: '$.challenge', message: 'Expected a challenge object.' }]
		};
	}

	const challenge = { ...value };
	for (const key of ['createdAt', 'updatedAt'] as const) {
		if (typeof challenge[key] === 'string') challenge[key] = new Date(challenge[key]);
	}
	const result = validateChallengeLibrary({ formatVersion: 1, challenges: [challenge] });
	if (!result.isValid) return { isValid: false, issues: result.issues };
	const validatedChallenge = result.value.challenges[0];
	if (!validatedChallenge) {
		return {
			isValid: false,
			issues: [{ path: '$.challenge', message: 'A challenge is required.' }]
		};
	}
	return { isValid: true, challenge: validatedChallenge };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Stores live sessions in memory and indexes them by viewer code.
 *
 * Sessions are not persisted; they are lost when this registry is discarded.
 * Returned sessions are cloned so callers cannot mutate the registry's stored state.
 * Only successful DM resumes, updates, and viewer-code regeneration refresh inactivity expiry.
 */
export class InMemoryLiveSessionRegistry {
	private readonly sessions = new Map<string, LiveSession>();
	private readonly sessionIdsByViewerCode = new Map<string, string>();
	private readonly reconnectTokenDigests = new Map<string, Buffer>();
	private readonly updateListeners = new Map<string, Set<LiveSessionUpdateListener>>();
	private readonly sessionExpirations = new Map<string, SessionExpiration>();
	private readonly maxActiveSessions: number;
	private readonly maxViewerConnectionsPerSession: number;
	private readonly sessionInactivityTimeoutMs: number;

	/**
	 * Creates an empty registry with fixed capacity and inactivity limits.
	 *
	 * @param options Session capacity, viewer capacity, and inactivity settings.
	 * @param options.maxActiveSessions Maximum number of active sessions; must be a non-negative safe integer.
	 * @param options.maxViewerConnectionsPerSession Maximum viewers per session; defaults to 100.
	 * @param options.sessionInactivityTimeoutMs Time without DM activity before expiry; defaults to six hours. Zero expires immediately.
	 * @throws {RangeError} If a limit is not a non-negative safe integer.
	 */
	constructor(
		options: Readonly<{
			maxActiveSessions: number;
			maxViewerConnectionsPerSession?: number;
			sessionInactivityTimeoutMs?: number;
		}>
	) {
		if (!Number.isSafeInteger(options.maxActiveSessions) || options.maxActiveSessions < 0) {
			throw new RangeError('The maximum active session count must be a non-negative integer.');
		}
		const maxViewerConnectionsPerSession =
			options.maxViewerConnectionsPerSession ?? DEFAULT_MAX_VIEWER_CONNECTIONS_PER_SESSION;
		if (
			!Number.isSafeInteger(maxViewerConnectionsPerSession) ||
			maxViewerConnectionsPerSession < 0
		) {
			throw new RangeError('The maximum viewer connection count must be a non-negative integer.');
		}
		const sessionInactivityTimeoutMs =
			options.sessionInactivityTimeoutMs ?? DEFAULT_SESSION_INACTIVITY_TIMEOUT_MS;
		if (!Number.isSafeInteger(sessionInactivityTimeoutMs) || sessionInactivityTimeoutMs < 0) {
			throw new RangeError('The session inactivity timeout must be a non-negative safe integer.');
		}

		this.maxActiveSessions = options.maxActiveSessions;
		this.maxViewerConnectionsPerSession = maxViewerConnectionsPerSession;
		this.sessionInactivityTimeoutMs = sessionInactivityTimeoutMs;
	}

	/**
	 * Creates a session from a challenge, retaining only its viewer display projection.
	 *
	 * The returned session is a clone; later mutations to the input or returned value do not
	 * change the session stored in this registry.
	 *
	 * @param challenge Challenge snapshot to project into viewer data.
	 * @returns A cloned session and its one-time reconnect credential.
	 * @throws {LiveSessionLimitError} If the registry is already at capacity.
	 */
	create(challenge: DeepReadonly<Challenge>): CreatedLiveSession {
		for (const sessionId of this.sessions.keys()) this.expireIfInactive(sessionId);
		if (this.sessions.size >= this.maxActiveSessions) {
			throw new LiveSessionLimitError();
		}

		let viewerCode = this.createViewerCode();
		while (this.sessionIdsByViewerCode.has(viewerCode)) {
			viewerCode = this.createViewerCode();
		}

		const session: LiveSession = {
			id: randomUUID(),
			viewerCode,
			challengeName: challenge.name,
			turnOrder: createViewerTurnOrder(challenge)
		};
		const reconnectToken = randomBytes(32).toString('base64url');
		this.sessions.set(session.id, session);
		this.sessionIdsByViewerCode.set(viewerCode, session.id);
		this.reconnectTokenDigests.set(session.id, this.hashReconnectToken(reconnectToken));
		this.scheduleExpiration(session.id, Date.now());
		return { session: structuredClone(session), reconnectToken };
	}

	/**
	 * Finds a session by viewer code, ignoring surrounding whitespace and letter case.
	 *
	 * Viewer lookups do not refresh inactivity expiry.
	 *
	 * @param viewerCode Code used to join the session.
	 * @returns A cloned session, or `undefined` if the code does not match an active session.
	 */
	findByViewerCode(viewerCode: string): LiveSession | undefined {
		const sessionId = this.sessionIdsByViewerCode.get(viewerCode.trim().toUpperCase());
		const session = sessionId === undefined ? undefined : this.getActiveSession(sessionId);
		return session === undefined ? undefined : structuredClone(session);
	}

	/**
	 * Resumes an active DM session and refreshes inactivity expiry when its reconnect token matches.
	 *
	 * @param sessionId Identifier returned when the session was created.
	 * @param reconnectToken Secret returned once when the session was created.
	 * @param challenge Latest challenge snapshot to project into viewer data, if supplied.
	 * @returns A cloned active session.
	 * @throws {LiveSessionNotFoundError} If the session is no longer active.
	 * @throws {LiveSessionAuthorizationError} If the reconnect token is invalid.
	 */
	resume(
		sessionId: string,
		reconnectToken: string,
		challenge?: DeepReadonly<Challenge>
	): LiveSession {
		const session = this.getActiveSession(sessionId);
		const storedDigest = this.reconnectTokenDigests.get(sessionId);
		if (!session || !storedDigest) throw new LiveSessionNotFoundError();

		const suppliedDigest = this.hashReconnectToken(reconnectToken);
		if (!timingSafeEqual(storedDigest, suppliedDigest)) {
			throw new LiveSessionAuthorizationError();
		}

		this.scheduleExpiration(sessionId, Date.now());
		if (challenge) {
			session.challengeName = challenge.name;
			session.turnOrder = createViewerTurnOrder(challenge);
			this.notifyUpdate(sessionId, session);
		}
		return structuredClone(session);
	}

	/**
	 * Subscribes to sanitized session snapshots and immediately provides the current snapshot.
	 *
	 * Viewer subscriptions do not refresh inactivity expiry.
	 *
	 * @param sessionId Identifier returned when the session was created.
	 * @param listener Called with each updated session, or `undefined` when it ends.
	 * @returns Function that removes this viewer subscription; repeated calls have no effect.
	 * @throws {LiveSessionNotFoundError} If the session is no longer active.
	 * @throws {LiveSessionViewerLimitError} If the session has reached its viewer limit.
	 */
	subscribeToUpdates(sessionId: string, listener: LiveSessionUpdateListener): () => void {
		const session = this.getActiveSession(sessionId);
		if (!session) throw new LiveSessionNotFoundError();

		let listeners = this.updateListeners.get(sessionId);
		if (!listeners) {
			listeners = new Set();
			this.updateListeners.set(sessionId, listeners);
		}
		if (listeners.size >= this.maxViewerConnectionsPerSession) {
			if (listeners.size === 0) this.updateListeners.delete(sessionId);
			throw new LiveSessionViewerLimitError();
		}
		listeners.add(listener);

		let isSubscribed = true;
		const unsubscribe = () => {
			if (!isSubscribed) return;
			isSubscribed = false;
			listeners?.delete(listener);
			if (listeners?.size === 0) this.updateListeners.delete(sessionId);
		};
		try {
			listener(structuredClone(session));
		} catch (error) {
			unsubscribe();
			throw error;
		}
		return unsubscribe;
	}

	/**
	 * Replaces the viewer code for an active session and refreshes inactivity expiry.
	 *
	 * @param sessionId Identifier returned when the session was created.
	 * @param reconnectToken Secret returned once when the session was created.
	 * @returns A cloned session with its new viewer code.
	 * @throws {LiveSessionNotFoundError} If the session is no longer active.
	 * @throws {LiveSessionAuthorizationError} If the reconnect token is invalid.
	 */
	regenerateViewerCode(sessionId: string, reconnectToken: string): LiveSession {
		const session = this.getActiveSession(sessionId);
		const storedDigest = this.reconnectTokenDigests.get(sessionId);
		if (!session || !storedDigest) throw new LiveSessionNotFoundError();

		const suppliedDigest = this.hashReconnectToken(reconnectToken);
		if (!timingSafeEqual(storedDigest, suppliedDigest)) {
			throw new LiveSessionAuthorizationError();
		}

		let viewerCode = this.createViewerCode(VIEWER_CODE_LENGTH);
		while (this.sessionIdsByViewerCode.has(viewerCode)) {
			viewerCode = this.createViewerCode(VIEWER_CODE_LENGTH);
		}
		this.sessionIdsByViewerCode.delete(session.viewerCode);
		session.viewerCode = viewerCode;
		this.sessionIdsByViewerCode.set(viewerCode, session.id);
		this.scheduleExpiration(sessionId, Date.now());
		return structuredClone(session);
	}

	/**
	 * Ends an active session and frees its viewer code and capacity.
	 *
	 * @param sessionId Identifier returned when the session was created.
	 * @returns `true` if the session existed, otherwise `false`.
	 */
	end(sessionId: string): boolean {
		const session = this.sessions.get(sessionId);
		if (session === undefined) {
			return false;
		}

		this.sessions.delete(sessionId);
		this.sessionIdsByViewerCode.delete(session.viewerCode);
		this.reconnectTokenDigests.delete(sessionId);
		clearTimeout(this.sessionExpirations.get(sessionId)?.timer);
		this.sessionExpirations.delete(sessionId);
		this.notifyUpdate(sessionId, undefined);
		return true;
	}

	/**
	 * Ends an active session when its reconnect token matches.
	 *
	 * @param sessionId Identifier returned when the session was created.
	 * @param reconnectToken Secret returned once when the session was created.
	 * @returns `true` when the session was ended.
	 * @throws {LiveSessionNotFoundError} If the session is no longer active.
	 * @throws {LiveSessionAuthorizationError} If the reconnect token is invalid.
	 */
	endAuthorized(sessionId: string, reconnectToken: string): true {
		const session = this.getActiveSession(sessionId);
		const storedDigest = this.reconnectTokenDigests.get(sessionId);
		if (!session || !storedDigest) throw new LiveSessionNotFoundError();

		const suppliedDigest = this.hashReconnectToken(reconnectToken);
		if (!timingSafeEqual(storedDigest, suppliedDigest)) {
			throw new LiveSessionAuthorizationError();
		}

		this.end(sessionId);
		return true;
	}

	private getActiveSession(sessionId: string): LiveSession | undefined {
		this.expireIfInactive(sessionId);
		return this.sessions.get(sessionId);
	}

	private expireIfInactive(sessionId: string): void {
		const expiration = this.sessionExpirations.get(sessionId);
		if (expiration && Date.now() - expiration.lastDmActivityAt >= this.sessionInactivityTimeoutMs) {
			this.end(sessionId);
		}
	}

	private scheduleExpiration(sessionId: string, lastDmActivityAt: number): void {
		clearTimeout(this.sessionExpirations.get(sessionId)?.timer);
		const remainingMs = this.sessionInactivityTimeoutMs - (Date.now() - lastDmActivityAt);
		// Node clamps overflowing timer delays to 1 ms; long timeouts need bounded chunks.
		const timer = setTimeout(
			() => {
				this.expireIfInactive(sessionId);
				if (this.sessions.has(sessionId)) this.scheduleExpiration(sessionId, lastDmActivityAt);
			},
			Math.max(0, Math.min(remainingMs, MAX_TIMER_DELAY_MS))
		);
		timer.unref?.();
		this.sessionExpirations.set(sessionId, { lastDmActivityAt, timer });
	}

	private hashReconnectToken(reconnectToken: string): Buffer {
		return createHash('sha256').update(reconnectToken).digest();
	}

	private notifyUpdate(sessionId: string, session: Readonly<LiveSession> | undefined): void {
		const listeners = this.updateListeners.get(sessionId);
		if (!listeners) return;
		if (session === undefined) this.updateListeners.delete(sessionId);
		for (const listener of listeners) {
			try {
				listener(session ? structuredClone(session) : undefined);
			} catch {
				listeners.delete(listener);
			}
		}
		if (listeners.size === 0) this.updateListeners.delete(sessionId);
	}

	private createViewerCode(length = VIEWER_CODE_LENGTH): string {
		return Array.from({ length }, () =>
			VIEWER_CODE_ALPHABET.charAt(randomInt(VIEWER_CODE_ALPHABET.length))
		).join('');
	}
}

const serverConfig = loadServerConfig();
/** Process-wide in-memory session registry used by the API routes. */
export const liveSessionRegistry = new InMemoryLiveSessionRegistry(serverConfig);
