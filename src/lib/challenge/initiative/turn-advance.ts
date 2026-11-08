import type { ChallengeRunState } from '../core/model';
import type { DeepReadonly } from '../../DeepReadonly';

/**
 * Advances a running challenge to its next turn by rotating the generated order:
 * the first (current) entry moves to the end. Advancing past the Spawn entry
 * counts one completed Spawn step.
 * @param runState Run state whose generated turn order should be rotated.
 * @returns A new run state with the rotated order and updated spawn count, or an unchanged copy when no order has been generated.
 */
export function advanceTurn(runState: DeepReadonly<ChallengeRunState>): ChallengeRunState {
	const order = runState.generatedTurnOrder;
	if (!order || order.length === 0) return structuredClone(runState) as ChallengeRunState;

	const [current, ...rest] = structuredClone(order) as NonNullable<
		ChallengeRunState['generatedTurnOrder']
	>;
	const next = {
		...(structuredClone(runState) as ChallengeRunState),
		generatedTurnOrder: [...rest, current!]
	};
	if (current!.kind === 'spawn') next.spawnCount = (runState.spawnCount ?? 0) + 1;
	return next;
}
