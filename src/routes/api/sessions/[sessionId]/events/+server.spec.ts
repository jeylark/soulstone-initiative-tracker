import { describe, expect, it } from 'vitest';
import { createUuid, type Challenge } from '#lib/challenge';
import { liveSessionRegistry } from '../../../../../lib/server/live-sessions';
import { GET } from './+server';

function createChallenge(): Challenge {
	const now = new Date('2026-11-03T12:00:00.000Z');
	const visibleTurnId = createUuid();
	const hiddenTurnId = createUuid();
	const playerFactionId = createUuid();
	const enemyFactionId = createUuid();
	return {
		id: createUuid(),
		name: 'SSE test',
		createdAt: now,
		updatedAt: now,
		factions: [
			{ id: playerFactionId, name: 'Players', color: 'blue' },
			{ id: enemyFactionId, name: 'Enemies', color: 'red' }
		],
		npcTypes: [],
		fairnessWeight: 0,
		creatures: [
			{
				id: createUuid(),
				kind: 'character',
				name: 'Visible character',
				factionId: playerFactionId,
				isHidden: false,
				turns: [{ id: visibleTurnId, initiative: { kind: 'static', value: 8 } }]
			},
			{
				id: createUuid(),
				kind: 'character',
				name: 'Hidden character',
				factionId: enemyFactionId,
				isHidden: true,
				turns: [{ id: hiddenTurnId, initiative: { kind: 'static', value: 4 } }]
			}
		],
		runState: {
			initiativeResults: {},
			generatedTurnOrder: [
				{ kind: 'turn', turnId: visibleTurnId },
				{ kind: 'turn', turnId: hiddenTurnId },
				{ kind: 'spawn' }
			]
		}
	};
}

describe('GET /api/sessions/[sessionId]/events', () => {
	it('streams the initial and updated visible turn order and a session-ended event', async () => {
		const challenge = createChallenge();
		const { session, reconnectToken } = liveSessionRegistry.create(challenge);
		const response = await GET({
			params: { sessionId: session.id },
			request: new Request(`http://localhost/api/sessions/${session.id}/events`)
		} as never);

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toContain('text/event-stream');
		const reader = response.body!.getReader();
		const initialEvent = new TextDecoder().decode((await reader.read()).value);
		expect(initialEvent).toContain('event: turn-order');
		expect(initialEvent).toContain('Visible character');
		expect(initialEvent).not.toContain('Hidden character');
		expect(initialEvent).toContain('"kind":"spawn"');
		expect(initialEvent).not.toContain('"creature"');
		expect(initialEvent).not.toContain(challenge.id);

		const updatedChallenge = structuredClone(challenge);
		const visibleCreature = updatedChallenge.creatures[0];
		if (!visibleCreature || visibleCreature.kind !== 'character') {
			throw new Error('Expected the first creature to be a character.');
		}
		visibleCreature.name = 'Updated visible character';
		liveSessionRegistry.resume(session.id, reconnectToken, updatedChallenge);
		const updateEvent = new TextDecoder().decode((await reader.read()).value);
		expect(updateEvent).toContain('event: turn-order');
		expect(updateEvent).toContain('Updated visible character');
		expect(updateEvent).not.toContain('Hidden character');

		liveSessionRegistry.end(session.id);
		const endedEvent = new TextDecoder().decode((await reader.read()).value);
		expect(endedEvent).toContain('event: session-ended');
		await reader.cancel();
	});

	it('returns not found for an inactive session', async () => {
		const response = await GET({
			params: { sessionId: 'missing-session' },
			request: new Request('http://localhost/api/sessions/missing-session/events')
		} as never);

		expect(response.status).toBe(404);
	});
});
