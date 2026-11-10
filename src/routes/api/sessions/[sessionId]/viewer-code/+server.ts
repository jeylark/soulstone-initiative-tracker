import type { RequestHandler } from './$types';
import {
	LiveSessionAuthorizationError,
	LiveSessionNotFoundError,
	liveSessionRegistry
} from '#lib/server';

/** Replaces an active session's viewer code using its DM reconnect credential. */
export const POST: RequestHandler = async ({ params, request }) => {
	const authorization = request.headers.get('authorization');
	const reconnectToken = authorization?.match(/^Bearer (.+)$/i)?.[1];
	if (!reconnectToken) {
		return Response.json({ message: 'A valid reconnect credential is required.' }, { status: 401 });
	}

	try {
		const session = liveSessionRegistry.regenerateViewerCode(params.sessionId, reconnectToken);
		return Response.json({ session });
	} catch (error) {
		if (error instanceof LiveSessionAuthorizationError) {
			return Response.json({ message: error.message }, { status: 401 });
		}
		if (error instanceof LiveSessionNotFoundError) {
			return Response.json({ message: error.message }, { status: 404 });
		}
		throw error;
	}
};
