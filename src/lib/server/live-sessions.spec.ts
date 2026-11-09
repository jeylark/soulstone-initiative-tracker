import { describe, expect, it } from 'vitest';
import { createUuid, type Challenge } from '../challenge';
import {
	InMemoryLiveSessionRegistry,
	LiveSessionAuthorizationError,
	LiveSessionLimitError,
	LiveSessionNotFoundError
} from './live-sessions';

function createChallenge(): Challenge {
	const now = new Date('2026-11-03T12:00:00.000Z');
	return {
		id: createUuid(),
		name: 'The Sunken Hall',
		createdAt: now,
		updatedAt: now,
		factions: [],
		npcTypes: [],
		fairnessWeight: 0,
		creatures: []
	};
}

describe('in-memory live session registry', () => {
	it('creates a session with a case-insensitive viewer code lookup', () => {
		const registry = new InMemoryLiveSessionRegistry({ maxActiveSessions: 2 });
		const challenge = createChallenge();

		const { session } = registry.create(challenge);

		expect(session.id).toBeTruthy();
		expect(session.viewerCode).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
		const lowercaseViewerCode = session.viewerCode.toLowerCase();
		expect(registry.findByViewerCode(lowercaseViewerCode)).toEqual(session);
		expect(registry.findByViewerCode(lowercaseViewerCode.toUpperCase())).toEqual(session);
	});

	it('isolates the stored challenge from input and returned mutations', () => {
		const registry = new InMemoryLiveSessionRegistry({ maxActiveSessions: 1 });
		const challenge = createChallenge();
		const { session } = registry.create(challenge);
		challenge.name = 'Changed outside the session';
		session.challenge.name = 'Changed through a lookup';

		expect(registry.findByViewerCode(session.viewerCode)?.challenge.name).toBe('The Sunken Hall');
	});

	it('refuses creation at capacity without evicting the existing session', () => {
		const registry = new InMemoryLiveSessionRegistry({ maxActiveSessions: 1 });
		const { session: firstSession } = registry.create(createChallenge());

		expect(() => registry.create(createChallenge())).toThrow(LiveSessionLimitError);
		expect(registry.findByViewerCode(firstSession.viewerCode)).toEqual(firstSession);
	});

	it('ends a session and makes its capacity available again', () => {
		const registry = new InMemoryLiveSessionRegistry({ maxActiveSessions: 1 });
		const { session, reconnectToken } = registry.create(createChallenge());

		expect(registry.end(session.id)).toBe(true);
		expect(registry.findByViewerCode(session.viewerCode)).toBeUndefined();
		expect(registry.end(session.id)).toBe(false);
		expect(registry.create(createChallenge()).session.id).not.toBe(session.id);
		expect(() => registry.resume(session.id, reconnectToken)).toThrow(LiveSessionNotFoundError);
	});

	it('resumes a session only with its reconnect token', () => {
		const registry = new InMemoryLiveSessionRegistry({ maxActiveSessions: 1 });
		const { session, reconnectToken } = registry.create(createChallenge());
		const updatedChallenge = { ...createChallenge(), name: 'Updated challenge' };

		expect(registry.resume(session.id, reconnectToken)).toEqual(session);
		expect(registry.resume(session.id, reconnectToken, updatedChallenge).challenge.name).toBe(
			'Updated challenge'
		);
		expect(() => registry.resume(session.id, 'incorrect-token')).toThrow(
			LiveSessionAuthorizationError
		);
	});

	it('does not expose the reconnect token through session lookups', () => {
		const registry = new InMemoryLiveSessionRegistry({ maxActiveSessions: 1 });
		const { session, reconnectToken } = registry.create(createChallenge());

		expect(registry.findByViewerCode(session.viewerCode)).not.toHaveProperty('reconnectToken');
		expect(JSON.stringify(session)).not.toContain(reconnectToken);
	});
});
