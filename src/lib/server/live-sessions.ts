import { randomInt, randomUUID } from 'node:crypto';
import type { DeepReadonly } from '../DeepReadonly';
import { sanitizeChallenge, type Challenge } from '../challenge';

const VIEWER_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const VIEWER_CODE_LENGTH = 8;

export interface LiveSession {
	id: string;
	viewerCode: string;
	challenge: Challenge;
}

export class LiveSessionLimitError extends Error {
	constructor() {
		super('The server has reached its active session limit.');
		this.name = 'LiveSessionLimitError';
	}
}

export class InMemoryLiveSessionRegistry {
	private readonly sessions = new Map<string, LiveSession>();
	private readonly sessionIdsByViewerCode = new Map<string, string>();
	private readonly maxActiveSessions: number;

	constructor(options: Readonly<{ maxActiveSessions: number }>) {
		if (!Number.isSafeInteger(options.maxActiveSessions) || options.maxActiveSessions < 0) {
			throw new RangeError('The maximum active session count must be a non-negative integer.');
		}

		this.maxActiveSessions = options.maxActiveSessions;
	}

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

	findByViewerCode(viewerCode: string): LiveSession | undefined {
		const sessionId = this.sessionIdsByViewerCode.get(viewerCode.trim().toUpperCase());
		const session = sessionId === undefined ? undefined : this.sessions.get(sessionId);
		return session === undefined ? undefined : structuredClone(session);
	}

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
