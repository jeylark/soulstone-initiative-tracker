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

describe('POST /api/sessions/[sessionId]/viewer-code', () => {
	it('regenerates the viewer code for an authorized session', async () => {
		const { session, reconnectToken } = liveSessionRegistry.create(createChallenge());
		const request = new Request(`http://localhost/api/sessions/${session.id}/viewer-code`, {
			method: 'POST',
			headers: new Headers([['authorization', `Bearer ${reconnectToken}`]])
		});

		const response = await POST({ params: { sessionId: session.id }, request } as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.session.id).toBe(session.id);
		expect(body.session.viewerCode).not.toBe(session.viewerCode);
		expect(liveSessionRegistry.findByViewerCode(session.viewerCode)).toBeUndefined();
		expect(liveSessionRegistry.findByViewerCode(body.session.viewerCode)).toMatchObject({
			id: session.id
		});
		liveSessionRegistry.end(session.id);
	});

	it('rejects missing credentials and reports an ended session', async () => {
		const { session, reconnectToken } = liveSessionRegistry.create(createChallenge());
		const unauthorizedRequest = new Request(
			`http://localhost/api/sessions/${session.id}/viewer-code`,
			{
				method: 'POST'
			}
		);
		const notFoundRequest = new Request(`http://localhost/api/sessions/${session.id}/viewer-code`, {
			method: 'POST',
			headers: new Headers([['authorization', `Bearer ${reconnectToken}`]])
		});

		const unauthorized = await POST({
			params: { sessionId: session.id },
			request: unauthorizedRequest
		} as never);
		liveSessionRegistry.end(session.id);
		const notFound = await POST({
			params: { sessionId: session.id },
			request: notFoundRequest
		} as never);

		expect(unauthorized.status).toBe(401);
		expect(notFound.status).toBe(404);
	});
});
