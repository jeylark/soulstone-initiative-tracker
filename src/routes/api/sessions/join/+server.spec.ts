import { describe, expect, it } from 'vitest';
import { createUuid, type Challenge } from '#lib/challenge';
import { liveSessionRegistry } from '../../../../lib/server/live-sessions';
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

function createRequest(body: unknown): Request {
	return new Request('http://localhost/api/sessions/join', {
		method: 'POST',
		headers: new Headers([['content-type', 'application/json']]),
		body: JSON.stringify(body)
	});
}

describe('POST /api/sessions/join', () => {
	it('resolves an active viewer code without exposing private session data', async () => {
		const { session } = liveSessionRegistry.create(createChallenge());

		const response = await POST({
			request: createRequest({ viewerCode: session.viewerCode.toLowerCase() })
		} as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ session: { id: session.id, viewerCode: session.viewerCode } });
		liveSessionRegistry.end(session.id);
	});

	it('rejects a malformed viewer code', async () => {
		const response = await POST({ request: createRequest({ viewerCode: 'ABC' }) } as never);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ message: 'The viewer code is invalid.' });
	});

	it('reports an ended session as not found', async () => {
		const { session } = liveSessionRegistry.create(createChallenge());
		liveSessionRegistry.end(session.id);

		const response = await POST({
			request: createRequest({ viewerCode: session.viewerCode })
		} as never);

		expect(response.status).toBe(404);
		expect(await response.json()).toMatchObject({
			message: 'No active session was found for this code.'
		});
	});
});
