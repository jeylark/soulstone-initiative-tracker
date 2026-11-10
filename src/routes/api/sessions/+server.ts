import type { RequestHandler } from './$types';
import {
	LiveSessionLimitError,
	liveSessionRegistry,
	validateLiveSessionChallenge
} from '#lib/server';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Creates an in-memory live session from the supplied challenge snapshot. */
export const POST: RequestHandler = async ({ request }) => {
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
		const created = liveSessionRegistry.create(challengeResult.challenge);
		return Response.json(created, { status: 201 });
	} catch (error) {
		if (error instanceof LiveSessionLimitError) {
			return Response.json({ message: error.message }, { status: 503 });
		}
		throw error;
	}
};
