import type { DeepReadonly } from '../DeepReadonly';
import type { Challenge, ViewerTurnOrderDisplayItem } from '../challenge';
import { createTurnDisplayLookup, createTurnOrderDisplay } from '../challenge/initiative';

/**
 * Builds the turn order safe to send to a read-only viewer.
 *
 * @param challenge Current session challenge snapshot.
 * @returns Generated turns with hidden creatures omitted, retaining Spawn entries.
 */
export function createViewerTurnOrder(
	challenge: DeepReadonly<Challenge>
): readonly ViewerTurnOrderDisplayItem[] {
	const runState = challenge.runState;
	if (!runState?.generatedTurnOrder) return [];

	return createTurnOrderDisplay(
		runState.generatedTurnOrder,
		createTurnDisplayLookup(challenge),
		runState.initiativeResults
	).items.flatMap((item): ViewerTurnOrderDisplayItem[] => {
		if (item.kind === 'spawn') return [{ kind: 'spawn' }];
		if (item.display.isHidden) return [];
		return [
			{
				kind: 'turn',
				turnId: item.turnId,
				display: {
					faction: item.display.faction
						? { name: item.display.faction.name, color: item.display.faction.color }
						: undefined,
					label: item.display.label,
					isHidden: false
				},
				initiative: item.initiative
			}
		];
	});
}
