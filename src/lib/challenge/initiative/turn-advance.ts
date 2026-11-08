import type { ChallengeRunState, StableId } from '../core/model';
import type { DeepReadonly } from '../../DeepReadonly';

/**
 * Advances a running challenge to its next turn by rotating the generated order:
 * the first (current) entry moves to the end, followed by any hidden turns at
 * the front of the order. Advancing past the Spawn entry counts one completed
 * Spawn step.
 * @param runState Run state whose generated turn order should be rotated.
 * @param hiddenTurnIds IDs of creature turns to rotate past when selecting the next current entry.
 * @returns A new run state with the rotated order and updated spawn count, or an unchanged copy when no order has been generated.
 */
export function advanceTurn(
	runState: DeepReadonly<ChallengeRunState>,
	hiddenTurnIds: ReadonlySet<StableId> = new Set()
): ChallengeRunState {
	const order = runState.generatedTurnOrder;
	if (!order || order.length === 0) return structuredClone(runState) as ChallengeRunState;

	let nextOrder = structuredClone(order) as NonNullable<ChallengeRunState['generatedTurnOrder']>;
	const next = structuredClone(runState) as ChallengeRunState;
	for (let rotations = 0; rotations < order.length; rotations += 1) {
		const [current, ...rest] = nextOrder;
		if (!current) break;
		nextOrder = [...rest, current];
		if (current.kind === 'spawn') next.spawnCount = (next.spawnCount ?? 0) + 1;

		const nextEntry = nextOrder[0];
		if (!nextEntry || nextEntry.kind === 'spawn' || !hiddenTurnIds.has(nextEntry.turnId)) break;
	}
	next.generatedTurnOrder = nextOrder;
	return next;
}
