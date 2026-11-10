import type { RequestHandler } from './$types';
import { liveSessionRegistry } from '#lib/server';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Resolves an active session and returns only its visible turn order to a viewer. */
export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return Response.json({ message: 'The request body must be valid JSON.' }, { status: 400 });
	}

	const viewerCode = isRecord(body) ? body.viewerCode : undefined;
	if (
		typeof viewerCode !== 'string' ||
		!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}(?:[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4})?$/i.test(
			viewerCode
		)
	) {
		return Response.json({ message: 'The viewer code is invalid.' }, { status: 400 });
	}

	const session = liveSessionRegistry.findByViewerCode(viewerCode);
	if (!session) {
		return Response.json(
			{ message: 'No active session was found for this code.' },
			{ status: 404 }
		);
	}

	return Response.json({
		session: { id: session.id, viewerCode: session.viewerCode },
		challengeName: session.challengeName,
		turnOrder: session.turnOrder
	});
};
