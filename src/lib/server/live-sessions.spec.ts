import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUuid, type Challenge } from '../challenge';
import {
	InMemoryLiveSessionRegistry,
	LiveSessionAuthorizationError,
	LiveSessionLimitError,
	LiveSessionNotFoundError,
	LiveSessionViewerLimitError
} from './live-sessions';
import { createRunChallenge } from '../../routes/challenges/[challengeId]/run/run-test-support';

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
	describe('inactivity expiry', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('automatically ends at the configured deadline, notifying viewers and freeing capacity', () => {
			const registry = new InMemoryLiveSessionRegistry({
				maxActiveSessions: 1,
				sessionInactivityTimeoutMs: 1_000
			});
			const { session, reconnectToken } = registry.create(createChallenge());
			const listener = vi.fn();
			registry.subscribeToUpdates(session.id, listener);

			vi.advanceTimersByTime(999);
			expect(registry.findByViewerCode(session.viewerCode)).toEqual(session);
			expect(listener).toHaveBeenCalledTimes(1);
			vi.advanceTimersByTime(1);

			expect(listener).toHaveBeenLastCalledWith(undefined);
			expect(listener).toHaveBeenCalledTimes(2);
			expect(registry.findByViewerCode(session.viewerCode)).toBeUndefined();
			expect(() => registry.resume(session.id, reconnectToken)).toThrow(LiveSessionNotFoundError);
			expect(() => registry.subscribeToUpdates(session.id, listener)).toThrow(
				LiveSessionNotFoundError
			);
			expect(registry.end(session.id)).toBe(false);
			expect(registry.create(createChallenge()).session.id).not.toBe(session.id);
		});

		it('does not refresh expiry for viewer lookups, connections, refused connections, or disconnects', () => {
			const registry = new InMemoryLiveSessionRegistry({
				maxActiveSessions: 1,
				maxViewerConnectionsPerSession: 1,
				sessionInactivityTimeoutMs: 1_000
			});
			const { session } = registry.create(createChallenge());
			vi.advanceTimersByTime(500);
			expect(registry.findByViewerCode(session.viewerCode)).toEqual(session);
			const unsubscribe = registry.subscribeToUpdates(session.id, vi.fn());
			expect(() => registry.subscribeToUpdates(session.id, vi.fn())).toThrow(
				LiveSessionViewerLimitError
			);
			unsubscribe();
			const listener = vi.fn();
			registry.subscribeToUpdates(session.id, listener);

			vi.advanceTimersByTime(500);
			expect(listener).toHaveBeenLastCalledWith(undefined);
			expect(registry.findByViewerCode(session.viewerCode)).toBeUndefined();
		});

		it.each(['resume', 'update', 'regenerate'] as const)(
			'refreshes expiry after an authenticated DM %s',
			(activity) => {
				const registry = new InMemoryLiveSessionRegistry({
					maxActiveSessions: 1,
					sessionInactivityTimeoutMs: 1_000
				});
				const { session, reconnectToken } = registry.create(createChallenge());
				const listener = vi.fn();
				registry.subscribeToUpdates(session.id, listener);
				vi.advanceTimersByTime(900);

				const refreshedSession =
					activity === 'regenerate'
						? registry.regenerateViewerCode(session.id, reconnectToken)
						: registry.resume(
								session.id,
								reconnectToken,
								activity === 'update' ? createChallenge() : undefined
							);

				vi.advanceTimersByTime(999);
				expect(registry.findByViewerCode(refreshedSession.viewerCode)).toEqual(refreshedSession);
				vi.advanceTimersByTime(1);
				expect(listener).toHaveBeenLastCalledWith(undefined);
				expect(registry.findByViewerCode(refreshedSession.viewerCode)).toBeUndefined();
			}
		);

		it('does not refresh expiry for failed DM authorization', () => {
			const registry = new InMemoryLiveSessionRegistry({
				maxActiveSessions: 1,
				sessionInactivityTimeoutMs: 1_000
			});
			const { session } = registry.create(createChallenge());
			vi.advanceTimersByTime(900);
			expect(() => registry.resume(session.id, 'wrong')).toThrow(LiveSessionAuthorizationError);
			expect(() => registry.regenerateViewerCode(session.id, 'wrong')).toThrow(
				LiveSessionAuthorizationError
			);
			expect(() => registry.endAuthorized(session.id, 'wrong')).toThrow(
				LiveSessionAuthorizationError
			);

			vi.advanceTimersByTime(100);
			expect(registry.findByViewerCode(session.viewerCode)).toBeUndefined();
		});

		it.each(['lookup', 'resume', 'subscribe', 'regenerate', 'end', 'create'] as const)(
			'enforces the deadline during %s even before a delayed timer callback runs',
			(operation) => {
				const registry = new InMemoryLiveSessionRegistry({
					maxActiveSessions: 1,
					sessionInactivityTimeoutMs: 1_000
				});
				const { session, reconnectToken } = registry.create(createChallenge());
				const listener = vi.fn();
				registry.subscribeToUpdates(session.id, listener);
				vi.setSystemTime(Date.now() + 1_000);

				switch (operation) {
					case 'lookup':
						expect(registry.findByViewerCode(session.viewerCode)).toBeUndefined();
						break;
					case 'resume':
						expect(() => registry.resume(session.id, reconnectToken)).toThrow(
							LiveSessionNotFoundError
						);
						break;
					case 'subscribe':
						expect(() => registry.subscribeToUpdates(session.id, vi.fn())).toThrow(
							LiveSessionNotFoundError
						);
						break;
					case 'regenerate':
						expect(() => registry.regenerateViewerCode(session.id, reconnectToken)).toThrow(
							LiveSessionNotFoundError
						);
						break;
					case 'end':
						expect(() => registry.endAuthorized(session.id, reconnectToken)).toThrow(
							LiveSessionNotFoundError
						);
						break;
					case 'create':
						expect(registry.create(createChallenge()).session.id).not.toBe(session.id);
						break;
				}
				expect(listener).toHaveBeenLastCalledWith(undefined);
			}
		);

		it('tracks each session independently and cancels timers when ended manually', () => {
			const registry = new InMemoryLiveSessionRegistry({
				maxActiveSessions: 2,
				sessionInactivityTimeoutMs: 1_000
			});
			const { session: first } = registry.create(createChallenge());
			vi.advanceTimersByTime(500);
			const { session: second } = registry.create(createChallenge());
			vi.advanceTimersByTime(500);
			expect(registry.findByViewerCode(first.viewerCode)).toBeUndefined();
			expect(registry.findByViewerCode(second.viewerCode)).toEqual(second);
			registry.end(second.id);
			expect(vi.getTimerCount()).toBe(0);
		});

		it('defaults to six hours without DM activity', () => {
			const registry = new InMemoryLiveSessionRegistry({ maxActiveSessions: 1 });
			const { session } = registry.create(createChallenge());
			vi.advanceTimersByTime(6 * 60 * 60 * 1_000 - 1);
			expect(registry.findByViewerCode(session.viewerCode)).toEqual(session);
			vi.advanceTimersByTime(1);
			expect(registry.findByViewerCode(session.viewerCode)).toBeUndefined();
		});

		it('expires immediately when the configured timeout is zero', () => {
			const registry = new InMemoryLiveSessionRegistry({
				maxActiveSessions: 1,
				sessionInactivityTimeoutMs: 0
			});
			const { session, reconnectToken } = registry.create(createChallenge());
			expect(() => registry.resume(session.id, reconnectToken)).toThrow(LiveSessionNotFoundError);
			expect(registry.findByViewerCode(session.viewerCode)).toBeUndefined();
			expect(registry.create(createChallenge()).session.id).not.toBe(session.id);
		});

		it('supports timeouts exceeding the maximum timer delay without expiring early', () => {
			const registry = new InMemoryLiveSessionRegistry({
				maxActiveSessions: 1,
				sessionInactivityTimeoutMs: 2 ** 31 + 1_000
			});
			const { session } = registry.create(createChallenge());
			vi.advanceTimersByTime(2 ** 31);
			expect(registry.findByViewerCode(session.viewerCode)).toEqual(session);
			vi.advanceTimersByTime(1_000);
			expect(registry.findByViewerCode(session.viewerCode)).toBeUndefined();
		});

		it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
			'rejects invalid timeout %s',
			(sessionInactivityTimeoutMs) => {
				expect(
					() =>
						new InMemoryLiveSessionRegistry({ maxActiveSessions: 1, sessionInactivityTimeoutMs })
				).toThrow(RangeError);
			}
		);
	});

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

	it('stores only viewer-display data instead of the full challenge', () => {
		const registry = new InMemoryLiveSessionRegistry({ maxActiveSessions: 1 });
		const challenge = createRunChallenge();
		const { session } = registry.create(challenge);
		challenge.name = 'Changed outside the session';
		expect(session).not.toHaveProperty('challenge');
		expect(session).toHaveProperty('turnOrder');
		expect(session.challengeName).toBe('Ashen Company');
		expect(session.turnOrder[0]).toMatchObject({
			kind: 'turn',
			display: { faction: { name: 'Players' }, label: 'Aria' },
			initiative: 6
		});
		expect(JSON.stringify(session)).not.toContain('"creature"');
		expect(JSON.stringify(session)).not.toContain('"position"');
		expect(JSON.stringify(session)).not.toContain('initiativeResults');

		expect(registry.findByViewerCode(session.viewerCode)).toEqual(session);
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

	it('ends a session only with its reconnect token', () => {
		const registry = new InMemoryLiveSessionRegistry({ maxActiveSessions: 1 });
		const { session, reconnectToken } = registry.create(createChallenge());

		expect(() => registry.endAuthorized(session.id, 'incorrect-token')).toThrow(
			LiveSessionAuthorizationError
		);
		expect(registry.findByViewerCode(session.viewerCode)).toEqual(session);

		expect(registry.endAuthorized(session.id, reconnectToken)).toBe(true);
		expect(registry.findByViewerCode(session.viewerCode)).toBeUndefined();
		expect(() => registry.resume(session.id, reconnectToken)).toThrow(LiveSessionNotFoundError);
	});

	it('resumes a session only with its reconnect token', () => {
		const registry = new InMemoryLiveSessionRegistry({ maxActiveSessions: 1 });
		const { session, reconnectToken } = registry.create(createChallenge());
		const updatedChallenge = { ...createChallenge(), name: 'Updated challenge' };

		expect(registry.resume(session.id, reconnectToken)).toEqual(session);
		const resumedSession = registry.resume(session.id, reconnectToken, updatedChallenge);
		expect(resumedSession).not.toHaveProperty('challenge');
		expect(resumedSession.challengeName).toBe('Updated challenge');
		expect(resumedSession.turnOrder).toEqual([]);
		expect(() => registry.resume(session.id, 'incorrect-token')).toThrow(
			LiveSessionAuthorizationError
		);
	});

	it('publishes the current and updated snapshots to active subscribers', () => {
		const registry = new InMemoryLiveSessionRegistry({ maxActiveSessions: 1 });
		const challenge = createChallenge();
		const { session, reconnectToken } = registry.create(challenge);
		const updates: (typeof session | undefined)[] = [];
		const unsubscribe = registry.subscribeToUpdates(session.id, (update) => updates.push(update));
		const updatedChallenge = { ...challenge, name: 'Updated challenge' };

		registry.resume(session.id, reconnectToken, updatedChallenge);

		expect(updates).toEqual([session, { ...session, challengeName: 'Updated challenge' }]);
		unsubscribe();
		registry.resume(session.id, reconnectToken, { ...createChallenge(), name: 'Not published' });
		expect(updates).toHaveLength(2);
		registry.end(session.id);
	});

	it('notifies subscribers when a session ends and releases their viewer capacity', () => {
		const registry = new InMemoryLiveSessionRegistry({
			maxActiveSessions: 1,
			maxViewerConnectionsPerSession: 1
		});
		const { session } = registry.create(createChallenge());
		const updates: (typeof session | undefined)[] = [];
		registry.subscribeToUpdates(session.id, (update) => updates.push(update));

		expect(() => registry.subscribeToUpdates(session.id, () => undefined)).toThrow(
			LiveSessionViewerLimitError
		);
		registry.end(session.id);

		expect(updates).toHaveLength(2);
		expect(updates[1]).toBeUndefined();
	});

	it('regenerates a viewer code and invalidates the previous code', () => {
		const registry = new InMemoryLiveSessionRegistry({ maxActiveSessions: 1 });
		const { session, reconnectToken } = registry.create(createChallenge());

		const regeneratedSession = registry.regenerateViewerCode(session.id, reconnectToken);

		expect(regeneratedSession.id).toBe(session.id);
		expect(regeneratedSession.viewerCode).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
		expect(regeneratedSession.viewerCode).not.toBe(session.viewerCode);
		expect(registry.findByViewerCode(session.viewerCode)).toBeUndefined();
		expect(registry.findByViewerCode(regeneratedSession.viewerCode)).toEqual(regeneratedSession);
	});

	it('refuses excess viewers per session without interrupting existing updates', () => {
		const registry = new InMemoryLiveSessionRegistry({
			maxActiveSessions: 2,
			maxViewerConnectionsPerSession: 1
		});
		const { session, reconnectToken } = registry.create(createChallenge());
		const { session: otherSession } = registry.create(createChallenge());
		const updates: (typeof session | undefined)[] = [];
		const unsubscribe = registry.subscribeToUpdates(session.id, (update) => updates.push(update));

		expect(() => registry.subscribeToUpdates(session.id, () => undefined)).toThrow(
			LiveSessionViewerLimitError
		);
		const unsubscribeOther = registry.subscribeToUpdates(otherSession.id, () => undefined);
		registry.resume(session.id, reconnectToken, { ...createChallenge(), name: 'Still connected' });

		expect(updates).toHaveLength(2);
		expect(updates[1]?.challengeName).toBe('Still connected');
		unsubscribe();
		unsubscribeOther();
	});

	it('releases viewer capacity exactly once even after a replacement viewer connects', () => {
		const registry = new InMemoryLiveSessionRegistry({
			maxActiveSessions: 1,
			maxViewerConnectionsPerSession: 1
		});
		const { session, reconnectToken } = registry.create(createChallenge());
		const unsubscribe = registry.subscribeToUpdates(session.id, () => undefined);
		unsubscribe();
		const updates: (typeof session | undefined)[] = [];
		const unsubscribeReplacement = registry.subscribeToUpdates(session.id, (update) =>
			updates.push(update)
		);
		unsubscribe();

		expect(() => registry.subscribeToUpdates(session.id, () => undefined)).toThrow(
			LiveSessionViewerLimitError
		);
		registry.resume(session.id, reconnectToken, { ...createChallenge(), name: 'Replacement' });
		expect(updates[1]?.challengeName).toBe('Replacement');
		unsubscribeReplacement();
	});

	it('refuses every viewer when the configured viewer limit is zero', () => {
		const registry = new InMemoryLiveSessionRegistry({
			maxActiveSessions: 1,
			maxViewerConnectionsPerSession: 0
		});
		const { session } = registry.create(createChallenge());

		expect(() => registry.subscribeToUpdates(session.id, () => undefined)).toThrow(
			LiveSessionViewerLimitError
		);
		expect(registry.findByViewerCode(session.viewerCode)).toEqual(session);
	});

	it('allows 100 concurrent viewers by default and refuses the next one', () => {
		const registry = new InMemoryLiveSessionRegistry({ maxActiveSessions: 1 });
		const { session } = registry.create(createChallenge());
		const unsubscribeViewers = Array.from({ length: 100 }, () =>
			registry.subscribeToUpdates(session.id, () => undefined)
		);

		expect(() => registry.subscribeToUpdates(session.id, () => undefined)).toThrow(
			LiveSessionViewerLimitError
		);
		unsubscribeViewers.forEach((unsubscribe) => unsubscribe());
		const unsubscribe = registry.subscribeToUpdates(session.id, () => undefined);
		expect(registry.findByViewerCode(session.viewerCode)).toEqual(session);
		unsubscribe();
	});

	it('requires the reconnect token to regenerate a viewer code', () => {
		const registry = new InMemoryLiveSessionRegistry({ maxActiveSessions: 1 });
		const { session } = registry.create(createChallenge());

		expect(() => registry.regenerateViewerCode(session.id, 'incorrect-token')).toThrow(
			LiveSessionAuthorizationError
		);
		expect(registry.findByViewerCode(session.viewerCode)).toEqual(session);
	});

	it('does not expose the reconnect token through session lookups', () => {
		const registry = new InMemoryLiveSessionRegistry({ maxActiveSessions: 1 });
		const { session, reconnectToken } = registry.create(createChallenge());

		expect(registry.findByViewerCode(session.viewerCode)).not.toHaveProperty('reconnectToken');
		expect(JSON.stringify(session)).not.toContain(reconnectToken);
	});
});
