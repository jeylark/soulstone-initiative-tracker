import { describe, expect, it } from 'vitest';
import { createUuid, type Challenge } from '#lib/challenge';
import { liveSessionRegistry } from '#lib/server';
import { POST } from './+server';

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

describe('POST /api/sessions', () => {
	it('creates a session from a validated challenge snapshot', async () => {
		const challenge = createChallenge();
		const request = new Request('http://localhost/api/sessions', {
			method: 'POST',
			headers: new Headers([['content-type', 'application/json']]),
			body: JSON.stringify({ challenge })
		});

		const response = await POST({ request } as never);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body.session).toHaveProperty('turnOrder');
		expect(body.session.challengeName).toBe(challenge.name);
		expect(body.session).not.toHaveProperty('challenge');
		expect(JSON.stringify(body)).not.toContain(challenge.id);
		expect(body.reconnectToken).toBeTruthy();
		expect(liveSessionRegistry.resume(body.session.id, body.reconnectToken).turnOrder).toEqual([]);
		liveSessionRegistry.end(body.session.id);
	});

	it('rejects malformed or invalid challenge requests without creating a session', async () => {
		const invalidRequest = new Request('http://localhost/api/sessions', {
			method: 'POST',
			headers: new Headers([['content-type', 'application/json']]),
			body: JSON.stringify({ challenge: { name: 'Incomplete' } })
		});

		const response = await POST({ request: invalidRequest } as never);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			message: 'The challenge is invalid.',
			issues: expect.arrayContaining([expect.objectContaining({ path: '$.challenges[0].id' })])
		});
	});
});
