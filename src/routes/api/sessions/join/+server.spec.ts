import { describe, expect, it } from 'vitest';
import { createUuid, type Challenge } from '#lib/challenge';
import { liveSessionRegistry } from '../../../../lib/server/live-sessions';
import { createSetupChallenge } from '../../../view-test-support';
import { POST } from './+server';

function createChallenge(): Challenge {
	const challenge = createSetupChallenge();
	const visibleTurnId = createUuid();
	const hiddenTurnId = createUuid();
	challenge.creatures = [
		{
			id: createUuid(),
			kind: 'character',
			name: 'Visible character',
			factionId: challenge.factions[0]!.id,
			isHidden: false,
			turns: [{ id: visibleTurnId, initiative: { kind: 'static', value: 8 } }]
		},
		{
			id: createUuid(),
			kind: 'character',
			name: 'Hidden character',
			factionId: challenge.factions[1]!.id,
			isHidden: true,
			turns: [{ id: hiddenTurnId, initiative: { kind: 'static', value: 4 } }]
		}
	];
	challenge.runState = {
		initiativeResults: {},
		generatedTurnOrder: [
			{ kind: 'turn', turnId: visibleTurnId },
			{ kind: 'turn', turnId: hiddenTurnId },
			{ kind: 'spawn' }
		]
	};
	return challenge;
}

function createRequest(body: unknown): Request {
	return new Request('http://localhost/api/sessions/join', {
		method: 'POST',
		headers: new Headers([['content-type', 'application/json']]),
		body: JSON.stringify(body)
	});
}

describe('POST /api/sessions/join', () => {
	it('returns the visible turn order without exposing hidden creatures or DM credentials', async () => {
		const { session, reconnectToken } = liveSessionRegistry.create(createChallenge());

		const response = await POST({
			request: createRequest({ viewerCode: session.viewerCode.toLowerCase() })
		} as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.session).toEqual({ id: session.id, viewerCode: session.viewerCode });
		expect(
			body.turnOrder.map((item: { kind: string; display?: { label: string } }) =>
				item.kind === 'turn' ? item.display?.label : 'Spawn'
			)
		).toEqual(['Visible character', 'Spawn']);
		expect(JSON.stringify(body)).not.toContain('Hidden character');
		expect(JSON.stringify(body)).not.toContain(reconnectToken);
		liveSessionRegistry.end(session.id);
	});

	it('accepts a regenerated eight-character viewer code', async () => {
		const { session, reconnectToken } = liveSessionRegistry.create(createChallenge());
		const regeneratedSession = liveSessionRegistry.regenerateViewerCode(session.id, reconnectToken);
		expect(regeneratedSession.viewerCode).toHaveLength(8);

		const response = await POST({
			request: createRequest({ viewerCode: regeneratedSession.viewerCode })
		} as never);

		expect(response.status).toBe(200);
		expect((await response.json()).session.viewerCode).toBe(regeneratedSession.viewerCode);
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
