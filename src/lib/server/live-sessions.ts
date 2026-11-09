import { randomInt, randomUUID } from 'node:crypto';
import type { DeepReadonly } from '../DeepReadonly';
import { sanitizeChallenge, type Challenge } from '../challenge';

const VIEWER_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const VIEWER_CODE_LENGTH = 8;

/** A sanitized challenge exposed through a live session. */
export interface LiveSession {
	/** Unique identifier used to end the session. */
	id: string;
	/** Eight-character code viewers can use to find this session. */
	viewerCode: string;
	/** Snapshot of the challenge associated with this session. */
	challenge: Challenge;
}

/** Thrown when creating a session would exceed the registry's configured capacity. */
export class LiveSessionLimitError extends Error {
	constructor() {
		super('The server has reached its active session limit.');
		this.name = 'LiveSessionLimitError';
	}
}

/**
 * Stores live sessions in memory and indexes them by viewer code.
 *
 * Sessions are not persisted; they are lost when this registry is discarded.
 * Returned sessions are cloned so callers cannot mutate the registry's stored state.
 */
export class InMemoryLiveSessionRegistry {
	private readonly sessions = new Map<string, LiveSession>();
	private readonly sessionIdsByViewerCode = new Map<string, string>();
	private readonly maxActiveSessions: number;

	/**
	 * Creates an empty registry with a fixed session capacity.
	 *
	 * @param options.maxActiveSessions Maximum number of active sessions; must be a non-negative safe integer.
	 * @throws {RangeError} If the capacity is not a non-negative safe integer.
	 */
	constructor(options: Readonly<{ maxActiveSessions: number }>) {
		if (!Number.isSafeInteger(options.maxActiveSessions) || options.maxActiveSessions < 0) {
			throw new RangeError('The maximum active session count must be a non-negative integer.');
		}

		this.maxActiveSessions = options.maxActiveSessions;
	}

	/**
	 * Creates a session from a sanitized snapshot of a challenge.
	 *
	 * The returned session is a clone; later mutations to the input or returned value do not
	 * change the session stored in this registry.
	 *
	 * @throws {LiveSessionLimitError} If the registry is already at capacity.
	 */
	create(challenge: DeepReadonly<Challenge>): LiveSession {
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
			challenge: sanitizeChallenge(challenge)
		};
		this.sessions.set(session.id, session);
		this.sessionIdsByViewerCode.set(viewerCode, session.id);
		return structuredClone(session);
	}

	/**
	 * Finds a session by viewer code, ignoring surrounding whitespace and letter case.
	 *
	 * @returns A cloned session, or `undefined` if the code does not match an active session.
	 */
	findByViewerCode(viewerCode: string): LiveSession | undefined {
		const sessionId = this.sessionIdsByViewerCode.get(viewerCode.trim().toUpperCase());
		const session = sessionId === undefined ? undefined : this.sessions.get(sessionId);
		return session === undefined ? undefined : structuredClone(session);
	}

	/**
	 * Ends an active session and frees its viewer code and capacity.
	 *
	 * @returns `true` if the session existed, otherwise `false`.
	 */
	end(sessionId: string): boolean {
		const session = this.sessions.get(sessionId);
		if (session === undefined) {
			return false;
		}

		this.sessions.delete(sessionId);
		this.sessionIdsByViewerCode.delete(session.viewerCode);
		return true;
	}

	private createViewerCode(): string {
		return Array.from({ length: VIEWER_CODE_LENGTH }, () =>
			VIEWER_CODE_ALPHABET.charAt(randomInt(VIEWER_CODE_ALPHABET.length))
		).join('');
	}
}
