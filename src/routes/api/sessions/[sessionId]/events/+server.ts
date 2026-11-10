import type { RequestHandler } from './$types';
import {
	LiveSessionNotFoundError,
	LiveSessionViewerLimitError,
	liveSessionRegistry
} from '#lib/server';

const encoder = new TextEncoder();
const STREAM_HEADERS = new Headers([
	['cache-control', 'no-cache, no-transform'],
	['connection', 'keep-alive'],
	['content-type', 'text/event-stream; charset=utf-8'],
	['x-accel-buffering', 'no']
]);

/**
 * Streams viewer-safe turn-order snapshots, or a terminal `viewer-limit` event when full.
 *
 * @param event Request and session identifier supplied by SvelteKit.
 * @returns An SSE response, or HTTP 404 when the session is inactive.
 */
export const GET: RequestHandler = ({ params, request }) => {
	let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
	let unsubscribe: () => void = () => {};
	let heartbeat: ReturnType<typeof setInterval> | undefined;
	let isEnded = false;
	const pendingMessages: Uint8Array[] = [];

	const send = (message: string): void => {
		const encodedMessage = encoder.encode(message);
		if (!controller) {
			pendingMessages.push(encodedMessage);
			return;
		}
		controller.enqueue(encodedMessage);
	};

	try {
		unsubscribe = liveSessionRegistry.subscribeToUpdates(params.sessionId, (session) => {
			if (!session) {
				send('event: session-ended\ndata: {}\n\n');
				isEnded = true;
				unsubscribe();
				if (controller) {
					if (heartbeat) clearInterval(heartbeat);
					controller.close();
				}
				return;
			}
			send(
				`event: turn-order\ndata: ${JSON.stringify({
					challengeName: session.challengeName,
					turnOrder: session.turnOrder
				})}\n\n`
			);
		});
	} catch (error) {
		if (error instanceof LiveSessionNotFoundError) {
			return Response.json({ message: error.message }, { status: 404 });
		}
		if (error instanceof LiveSessionViewerLimitError) {
			// EventSource cannot expose an HTTP error body to the viewer.
			return new Response('event: viewer-limit\ndata: {}\n\n', { headers: STREAM_HEADERS });
		}
		throw error;
	}

	const stream = new ReadableStream<Uint8Array>({
		start(streamController) {
			controller = streamController;
			for (const message of pendingMessages) controller.enqueue(message);
			pendingMessages.length = 0;
			if (isEnded) {
				controller.close();
				return;
			}
			heartbeat = setInterval(() => {
				try {
					controller?.enqueue(encoder.encode(': keep-alive\n\n'));
				} catch {
					unsubscribe();
					if (heartbeat) clearInterval(heartbeat);
				}
			}, 15_000);
			request.signal.addEventListener(
				'abort',
				() => {
					unsubscribe();
					if (heartbeat) clearInterval(heartbeat);
				},
				// eslint-disable-next-line @typescript-eslint/naming-convention -- native AddEventListenerOptions name
				{ once: true }
			);
		},
		cancel() {
			unsubscribe();
			if (heartbeat) clearInterval(heartbeat);
		}
	});

	return new Response(stream, {
		headers: STREAM_HEADERS
	});
};
