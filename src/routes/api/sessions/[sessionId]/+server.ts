import type { RequestHandler } from './$types';
import {
	LiveSessionAuthorizationError,
	LiveSessionNotFoundError,
	liveSessionRegistry,
	validateLiveSessionChallenge
} from '../../../../lib/server/live-sessions';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Resumes an active DM session and refreshes its server snapshot. */
export const PUT: RequestHandler = async ({ params, request }) => {
	const authorization = request.headers.get('authorization');
	const reconnectToken = authorization?.match(/^Bearer (.+)$/i)?.[1];
	if (!reconnectToken) {
		return Response.json({ message: 'A valid reconnect credential is required.' }, { status: 401 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return Response.json({ message: 'The request body must be valid JSON.' }, { status: 400 });
	}

	const challengeResult = validateLiveSessionChallenge(isRecord(body) ? body.challenge : undefined);
	if (!challengeResult.isValid) {
		return Response.json(
			{ message: 'The challenge is invalid.', issues: challengeResult.issues },
			{ status: 400 }
		);
	}

	try {
		const session = liveSessionRegistry.resume(
			params.sessionId,
			reconnectToken,
			challengeResult.challenge
		);
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

/** Ends an active DM session and invalidates its reconnect credential. */
export const DELETE: RequestHandler = async ({ params, request }) => {
	const authorization = request.headers.get('authorization');
	const reconnectToken = authorization?.match(/^Bearer (.+)$/i)?.[1];
	if (!reconnectToken) {
		return Response.json({ message: 'A valid reconnect credential is required.' }, { status: 401 });
	}

	try {
		liveSessionRegistry.endAuthorized(params.sessionId, reconnectToken);
		return new Response(null, { status: 204 });
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
