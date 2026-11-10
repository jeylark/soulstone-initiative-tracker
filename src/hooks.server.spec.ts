import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writeDiagnosticLog } from '#lib/server';
import { handle, handleError } from './hooks.server';

vi.mock('./lib/server/diagnostic-logger', () => ({
	writeDiagnosticLog: vi.fn()
}));

beforeEach(() => {
	vi.clearAllMocks();
});

describe('server request diagnostics', () => {
	it('logs request metadata with a correlation ID without recording the URL or headers', async () => {
		const request = new Request(
			'http://localhost/api/sessions/SESSION-SECRET?viewerCode=VIEWER-SECRET',
			{
				method: 'GET',
				headers: { authorization: 'Bearer TOKEN-SECRET' }
			}
		);
		const event = {
			request,
			route: { id: '/api/sessions/[sessionId]' },
			locals: {}
		};

		const response = await handle({
			event: event as never,
			resolve: async () => new Response(null, { status: 404 })
		});

		expect(response.status).toBe(404);
		const [entry] = vi.mocked(writeDiagnosticLog).mock.calls[0] ?? [];
		expect(entry).toMatchObject({
			severity: 'warn',
			event: 'http.request.completed',
			source: '/api/sessions/[sessionId]',
			method: 'GET',
			status: 404
		});
		expect(entry?.correlationId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
		);
		const serialized = JSON.stringify(entry);
		expect(serialized).not.toContain('SESSION-SECRET');
		expect(serialized).not.toContain('VIEWER-SECRET');
		expect(serialized).not.toContain('TOKEN-SECRET');
	});

	it('logs unhandled errors with the request correlation ID', () => {
		const event = {
			request: new Request('http://localhost/api/sessions'),
			route: { id: '/api/sessions' },
			locals: { correlationId: 'request-id' }
		};

		handleError({
			error: new Error('private challenge contents'),
			event: event as never,
			status: 500,
			message: 'Internal Error'
		} as never);

		expect(writeDiagnosticLog).toHaveBeenCalledWith(
			expect.objectContaining({
				severity: 'error',
				event: 'http.request.failed',
				source: '/api/sessions',
				correlationId: 'request-id'
			})
		);
	});
});
