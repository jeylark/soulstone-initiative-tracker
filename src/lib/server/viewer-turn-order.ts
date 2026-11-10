import type { DeepReadonly } from '../DeepReadonly';
import type { Challenge, TurnOrderDisplayItem } from '../challenge';
import { createTurnDisplayLookup, createTurnOrderDisplay } from '../challenge/initiative';

/**
 * Builds the turn order safe to send to a read-only viewer.
 *
 * @param challenge Current session challenge snapshot.
 * @returns Generated turns with hidden creatures omitted, retaining Spawn entries.
 */
export function createViewerTurnOrder(
	challenge: DeepReadonly<Challenge>
): readonly TurnOrderDisplayItem[] {
	const runState = challenge.runState;
	if (!runState?.generatedTurnOrder) return [];

	return createTurnOrderDisplay(
		runState.generatedTurnOrder,
		createTurnDisplayLookup(challenge),
		runState.initiativeResults
	).items.filter((item) => item.kind === 'spawn' || !item.display.isHidden);
}
