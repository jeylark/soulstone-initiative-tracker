import { describe, expect, it } from 'vitest';
import { createUuid, type Challenge } from '#lib/challenge';
import { liveSessionRegistry } from '#lib/server';
import { DELETE, PUT } from './+server';

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

describe('PUT /api/sessions/[sessionId]', () => {
	it('updates an active session without retaining or returning the challenge snapshot', async () => {
		const { session, reconnectToken } = liveSessionRegistry.create(createChallenge());
		const challenge = createChallenge();
		const request = new Request(`http://localhost/api/sessions/${session.id}`, {
			method: 'PUT',
			headers: new Headers([
				['authorization', `Bearer ${reconnectToken}`],
				['content-type', 'application/json']
			]),
			body: JSON.stringify({ challenge })
		});

		const response = await PUT({ params: { sessionId: session.id }, request } as never);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toMatchObject({
			session: {
				id: session.id,
				viewerCode: session.viewerCode,
				challengeName: challenge.name,
				turnOrder: []
			}
		});
		expect(JSON.stringify(body)).not.toContain(challenge.id);
		liveSessionRegistry.end(session.id);
	});

	it('rejects missing and invalid credentials', async () => {
		const { session } = liveSessionRegistry.create(createChallenge());
		const request = new Request(`http://localhost/api/sessions/${session.id}`, {
			method: 'PUT',
			body: JSON.stringify({ challenge: createChallenge() })
		});

		const response = await PUT({ params: { sessionId: session.id }, request } as never);

		expect(response.status).toBe(401);
		liveSessionRegistry.end(session.id);
	});

	it('reports sessions that are no longer active', async () => {
		const request = new Request('http://localhost/api/sessions/missing', {
			method: 'PUT',
			headers: new Headers([
				['authorization', 'Bearer token'],
				['content-type', 'application/json']
			]),
			body: JSON.stringify({ challenge: createChallenge() })
		});

		const response = await PUT({ params: { sessionId: 'missing' }, request } as never);

		expect(response.status).toBe(404);
	});
});

describe('DELETE /api/sessions/[sessionId]', () => {
	it('ends an active session with its reconnect credential', async () => {
		const { session, reconnectToken } = liveSessionRegistry.create(createChallenge());
		const request = new Request(`http://localhost/api/sessions/${session.id}`, {
			method: 'DELETE',
			headers: new Headers([['authorization', `Bearer ${reconnectToken}`]])
		});

		const response = await DELETE({ params: { sessionId: session.id }, request } as never);

		expect(response.status).toBe(204);
		expect(await response.text()).toBe('');
		expect(liveSessionRegistry.findByViewerCode(session.viewerCode)).toBeUndefined();
	});

	it('rejects missing and invalid credentials without ending the session', async () => {
		const { session } = liveSessionRegistry.create(createChallenge());
		const unauthenticatedRequest = new Request(`http://localhost/api/sessions/${session.id}`, {
			method: 'DELETE'
		});
		const unauthenticatedResponse = await DELETE({
			params: { sessionId: session.id },
			request: unauthenticatedRequest
		} as never);
		const request = new Request(`http://localhost/api/sessions/${session.id}`, {
			method: 'DELETE',
			headers: new Headers([['authorization', 'Bearer incorrect-token']])
		});

		const response = await DELETE({ params: { sessionId: session.id }, request } as never);

		expect(unauthenticatedResponse.status).toBe(401);
		expect(response.status).toBe(401);
		expect(liveSessionRegistry.findByViewerCode(session.viewerCode)).toBeDefined();
		liveSessionRegistry.end(session.id);
	});

	it('reports a session that is no longer active', async () => {
		const request = new Request('http://localhost/api/sessions/missing', {
			method: 'DELETE',
			headers: new Headers([['authorization', 'Bearer stale-token']])
		});

		const response = await DELETE({ params: { sessionId: 'missing' }, request } as never);

		expect(response.status).toBe(404);
	});
});
