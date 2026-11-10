import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUuid, type Challenge } from '#lib/challenge';
import { InMemoryLiveSessionRegistry, liveSessionRegistry } from '#lib/server';
import { GET } from './+server';

afterEach(() => {
	vi.restoreAllMocks();
});

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
		expect(initialEvent).toContain('"challengeName":"SSE test"');
		expect(initialEvent).not.toContain('"creature"');
		expect(initialEvent).not.toContain(challenge.id);

		const updatedChallenge = structuredClone(challenge);
		const visibleCreature = updatedChallenge.creatures[0];
		if (!visibleCreature || visibleCreature.kind !== 'character') {
			throw new Error('Expected the first creature to be a character.');
		}
		visibleCreature.name = 'Updated visible character';
		updatedChallenge.name = 'Updated SSE test';
		liveSessionRegistry.resume(session.id, reconnectToken, updatedChallenge);
		const updateEvent = new TextDecoder().decode((await reader.read()).value);
		expect(updateEvent).toContain('event: turn-order');
		expect(updateEvent).toContain('"challengeName":"Updated SSE test"');
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

	it('sends a terminal refusal when full while keeping existing viewers connected', async () => {
		const registry = new InMemoryLiveSessionRegistry({
			maxActiveSessions: 1,
			maxViewerConnectionsPerSession: 1
		});
		vi.spyOn(liveSessionRegistry, 'subscribeToUpdates').mockImplementation(
			registry.subscribeToUpdates.bind(registry)
		);
		const { session, reconnectToken } = registry.create(createChallenge());
		const abortController = new AbortController();
		const connect = (signal?: Readonly<AbortSignal>) =>
			GET({
				params: { sessionId: session.id },
				request: new Request(`http://localhost/api/sessions/${session.id}/events`, { signal })
			} as never);
		const firstResponse = await connect(abortController.signal);
		const reader = firstResponse.body!.getReader();

		try {
			await reader.read();
			const refusal = await connect();
			expect(refusal.status).toBe(200);
			expect(refusal.headers.get('content-type')).toContain('text/event-stream');
			expect(await refusal.text()).toBe('event: viewer-limit\ndata: {}\n\n');

			registry.resume(session.id, reconnectToken, {
				...createChallenge(),
				name: 'Existing viewer still connected'
			});
			expect(new TextDecoder().decode((await reader.read()).value)).toContain(
				'Existing viewer still connected'
			);

			abortController.abort();
			const replacement = await connect();
			try {
				expect(replacement.status).toBe(200);
				await reader.cancel();
				const secondRefusal = await connect();
				expect(await secondRefusal.text()).toBe('event: viewer-limit\ndata: {}\n\n');
			} finally {
				await replacement.body?.cancel();
			}

			const afterCancellation = await connect();
			try {
				expect(afterCancellation.headers.get('content-type')).toContain('text/event-stream');
				const replacementReader = afterCancellation.body!.getReader();
				expect(new TextDecoder().decode((await replacementReader.read()).value)).toContain(
					'event: turn-order'
				);
				await replacementReader.cancel();
			} finally {
				registry.end(session.id);
			}
		} finally {
			await reader.cancel();
			registry.end(session.id);
		}
	});
});
