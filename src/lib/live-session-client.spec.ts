import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUuid, type Challenge } from '#lib/challenge';
import {
	createLiveSession,
	deleteLiveSessionCredential,
	endLiveSession,
	joinLiveSession,
	loadLiveSessionCredential,
	LiveSessionRequestError,
	regenerateViewerCode,
	resumeLiveSession,
	saveLiveSessionCredential,
	updateLiveSession
} from './live-session-client';

let indexedDbFactory: IDBFactory;

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

beforeEach(() => {
	indexedDbFactory = new IDBFactory();
	vi.stubGlobal('indexedDB', indexedDbFactory);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('live session client', () => {
	it('stores, loads, and removes reconnect credentials', async () => {
		const credential = {
			challengeId: createUuid(),
			sessionId: 'session-id',
			reconnectToken: 'secret-token'
		};

		await saveLiveSessionCredential(credential, indexedDbFactory);

		await expect(
			loadLiveSessionCredential(credential.challengeId, indexedDbFactory)
		).resolves.toEqual(credential);
		await deleteLiveSessionCredential(credential.challengeId, indexedDbFactory);
		await expect(
			loadLiveSessionCredential(credential.challengeId, indexedDbFactory)
		).resolves.toBeUndefined();
	});

	it('sends the challenge to the server when creating a session', async () => {
		const challenge = createChallenge();
		const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					session: { id: 'session-id', viewerCode: 'A234', challenge },
					reconnectToken: 'secret-token'
				}),
				{ status: 201 }
			)
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(createLiveSession(challenge)).resolves.toEqual({
			session: { id: 'session-id', viewerCode: 'A234' },
			reconnectToken: 'secret-token'
		});
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/sessions',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ challenge })
			})
		);
	});

	it('looks up an active session using its viewer code', async () => {
		const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
			Response.json({
				session: { id: 'session-id', viewerCode: 'A234' },
				challengeName: 'Ashen Company',
				turnOrder: []
			})
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(joinLiveSession('A234')).resolves.toEqual({
			session: { id: 'session-id', viewerCode: 'A234' },
			challengeName: 'Ashen Company',
			turnOrder: []
		});
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/sessions/join',
			expect.objectContaining({
				method: 'POST',
				body: JSON.stringify({ viewerCode: 'A234' })
			})
		);
	});

	it('preserves inactive viewer-code errors', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn<typeof fetch>()
				.mockResolvedValue(
					Response.json({ message: 'No active session was found for this code.' }, { status: 404 })
				)
		);

		await expect(joinLiveSession('A234')).rejects.toMatchObject({
			constructor: LiveSessionRequestError,
			status: 404,
			message: 'No active session was found for this code.'
		});
	});

	it('sends a bearer credential when resuming a session', async () => {
		const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(
				JSON.stringify({
					session: { id: 'session-id', viewerCode: 'A234', challenge: createChallenge() }
				}),
				{ status: 200 }
			)
		);
		vi.stubGlobal('fetch', fetchMock);
		const credential = {
			challengeId: createUuid(),
			sessionId: 'session-id',
			reconnectToken: 'secret-token'
		};

		const challenge = createChallenge();
		await expect(resumeLiveSession(credential, challenge)).resolves.toEqual({
			id: 'session-id',
			viewerCode: 'A234'
		});
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/sessions/session-id',
			expect.objectContaining({ method: 'PUT', body: JSON.stringify({ challenge }) })
		);
		const requestOptions = fetchMock.mock.calls[0]?.[1];
		const headers = new Headers(requestOptions?.headers);
		expect(headers.get('authorization')).toBe('Bearer secret-token');
		expect(headers.get('content-type')).toBe('application/json');
	});

	it('publishes the latest challenge snapshot to the live session', async () => {
		const challenge = createChallenge();
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(Response.json({ session: { id: 'session-id', viewerCode: 'A234' } }));
		vi.stubGlobal('fetch', fetchMock);
		const credential = {
			challengeId: createUuid(),
			sessionId: 'session-id',
			reconnectToken: 'secret-token'
		};

		await updateLiveSession(credential, challenge);

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/sessions/session-id',
			expect.objectContaining({ method: 'PUT', body: JSON.stringify({ challenge }) })
		);
	});

	it('regenerates a viewer code with the saved DM credential', async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValue(Response.json({ session: { id: 'session-id', viewerCode: 'ABCDEFGH' } }));
		vi.stubGlobal('fetch', fetchMock);
		const credential = {
			challengeId: createUuid(),
			sessionId: 'session-id',
			reconnectToken: 'secret-token'
		};

		await expect(regenerateViewerCode(credential)).resolves.toEqual({
			id: 'session-id',
			viewerCode: 'ABCDEFGH'
		});
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/sessions/session-id/viewer-code',
			expect.objectContaining({ method: 'POST' })
		);
		const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
		expect(headers.get('authorization')).toBe('Bearer secret-token');
	});

	it('ends a session with its bearer reconnect credential', async () => {
		const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal('fetch', fetchMock);
		const credential = {
			challengeId: createUuid(),
			sessionId: 'session-id',
			reconnectToken: 'secret-token'
		};

		await expect(endLiveSession(credential)).resolves.toBeUndefined();
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/sessions/session-id',
			expect.objectContaining({ method: 'DELETE' })
		);
		const requestOptions = fetchMock.mock.calls[0]?.[1];
		const headers = new Headers(requestOptions?.headers);
		expect(headers.get('authorization')).toBe('Bearer secret-token');
	});

	it('treats a missing session as already ended', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn<typeof fetch>()
				.mockResolvedValue(
					Response.json({ message: 'The live session is no longer active.' }, { status: 404 })
				)
		);

		await expect(
			endLiveSession({
				challengeId: createUuid(),
				sessionId: 'missing-session',
				reconnectToken: 'secret-token'
			})
		).resolves.toBeUndefined();
	});

	it('preserves API errors for the caller', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn<typeof fetch>()
				.mockResolvedValue(Response.json({ message: 'Session limit reached.' }, { status: 503 }))
		);

		await expect(createLiveSession(createChallenge())).rejects.toMatchObject({
			constructor: LiveSessionRequestError,
			status: 503,
			message: 'Session limit reached.'
		});
	});
});
