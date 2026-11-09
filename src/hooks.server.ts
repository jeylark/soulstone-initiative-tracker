import { randomUUID } from 'node:crypto';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { writeDiagnosticLog } from './lib/server/diagnostic-logger';

/**
 * Adds a request correlation ID and logs safe request completion metadata.
 *
 * @param input Request event and SvelteKit route resolver.
 * @returns The resolved HTTP response.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const correlationId = randomUUID();
	const startedAt = performance.now();
	event.locals.correlationId = correlationId;

	const response = await resolve(event);
	const status = response.status;
	writeDiagnosticLog({
		severity: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
		event: 'http.request.completed',
		source: event.route.id ?? 'unmatched-route',
		correlationId,
		method: event.request.method,
		status,
		durationMs: Math.max(0, Math.round(performance.now() - startedAt))
	});
	return response;
};

/**
 * Logs an unhandled server error without including its potentially sensitive message.
 *
 * @param input Error and request details provided by SvelteKit.
 * @returns Nothing; SvelteKit supplies the client-facing error response.
 */
export const handleError: HandleServerError = ({ error, event }) => {
	writeDiagnosticLog({
		severity: 'error',
		event: 'http.request.failed',
		source: event.route.id ?? 'unmatched-route',
		correlationId: event.locals.correlationId ?? randomUUID(),
		error
	});
};
