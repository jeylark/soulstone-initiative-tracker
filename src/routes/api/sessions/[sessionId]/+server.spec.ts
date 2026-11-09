import { describe, expect, it } from 'vitest';
import { createUuid, type Challenge } from '#lib/challenge';
import { liveSessionRegistry } from '../../../../lib/server/live-sessions';
import { PUT } from './+server';

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
	it('resumes an active session and updates its challenge snapshot', async () => {
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
		expect(await response.json()).toMatchObject({
			session: { id: session.id, viewerCode: session.viewerCode, challenge: { id: challenge.id } }
		});
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
