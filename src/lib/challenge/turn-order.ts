import type {
	Challenge,
	GeneratedTurnOrder,
	GeneratedTurnOrderEntry,
	InitiativeResults,
	StableId
} from './model';
import type { DeepReadonly } from '../DeepReadonly';

type InitiativeTurn = {
	readonly id: StableId;
	readonly initiative: number;
};
type FixedTurn = {
	readonly id: StableId;
	readonly kind: 'fixed-position';
	readonly from: 'top' | 'bottom';
	readonly position: number;
};
type RelativeTurn = {
	readonly id: StableId;
	readonly kind: 'relative-position';
	readonly relation: 'before' | 'after';
	readonly distance: number;
	readonly targetTurnId: StableId;
};
type HookedTurn = FixedTurn | RelativeTurn;

/** Thrown when placement hooks cannot be resolved into a turn order. */
export class TurnOrderError extends Error {
	/** IDs of the turns whose placement could not be resolved, in setup order. */
	readonly turnIds: StableId[];

	/**
	 * @param turnIds IDs of the turns whose placement could not be resolved.
	 */
	constructor(turnIds: readonly StableId[]) {
		super(`Cannot place turns: ${turnIds.join(', ')}`);
		this.name = 'TurnOrderError';
		this.turnIds = [...turnIds];
	}
}

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

function filterFactionTurns(
	challenge: DeepReadonly<Challenge>,
	initiativeResults: Readonly<InitiativeResults>
): [Map<StableId, InitiativeTurn[]>, HookedTurn[]] {
	const turnsByFaction: Map<StableId, InitiativeTurn[]> = new Map();
	const hookedTurns: HookedTurn[] = [];

	for (const creature of challenge.creatures) {
		const factionTurns = turnsByFaction.getOrInsert(creature.factionId, []);

		for (const turn of creature.turns) {
			if (turn.initiative.kind === 'roll') {
				const initiativeValue = initiativeResults[turn.id];
				if (initiativeValue === undefined) {
					continue;
				}
				factionTurns.push({ id: turn.id, initiative: initiativeValue });
			} else if (turn.initiative.kind === 'static') {
				factionTurns.push({ id: turn.id, initiative: turn.initiative.value });
			} else if (turn.initiative.kind === 'fixed-position') {
				hookedTurns.push({
					id: turn.id,
					kind: 'fixed-position',
					from: turn.initiative.from,
					position: turn.initiative.position
				});
			} else if (turn.initiative.kind === 'relative-position') {
				hookedTurns.push({
					id: turn.id,
					kind: 'relative-position',
					relation: turn.initiative.relation,
					distance: turn.initiative.distance,
					targetTurnId: turn.initiative.targetTurnId
				});
			}
		}
	}

	return [turnsByFaction, hookedTurns];
}

/**
 * Generates a turn order from a challenge's setup and collected initiative results.
 * The challenge's `fairnessWeight` balances faction distribution against initiative:
 * 0	Pure value-based merge
 * 1	Value has strong influence
 * 3	Balanced approach
 * 5	Stronger distribution fairness
 * 10+	Nearly proportional round-robin
 * @param challenge Challenge whose creature turns, placement rules and fairness weight define the order.
 * @param initiativeResults Initiative values collected for rolling turns.
 * @returns Generated play order of turn entries followed by the Spawn entry.
 * @throws {TurnOrderError} If a relative placement targets a turn that is missing from the order or the placements form a cycle.
 */
export function generateTurnOrder(
	challenge: DeepReadonly<Challenge>,
	initiativeResults: Readonly<InitiativeResults>
): GeneratedTurnOrder {
	const { fairnessWeight } = challenge;
	const [turnsByFaction, hookedTurns] = filterFactionTurns(challenge, initiativeResults);

	const totalInitiativeTurnCount = turnsByFaction
		.values()
		.reduce((sum, factionTurns) => sum + factionTurns.length, 0);
	const factions = [...turnsByFaction.values()].map((factionTurns) => {
		const totalFactionTurns = factionTurns.length;
		const remainingFactionTurns = factionTurns.toSorted((a, b) => b.initiative - a.initiative);

		function takeNextTurn() {
			return remainingFactionTurns.shift();
		}
		function remainingTurnCount() {
			return remainingFactionTurns.length;
		}
		function hasRemainingTurns() {
			return remainingTurnCount() > 0;
		}
		function priority(position: number) {
			const remainingTurnCount = remainingFactionTurns.length;
			if (remainingTurnCount === 0) return -Infinity;

			const turnsTaken = totalFactionTurns - remainingTurnCount;
			const expectedTurnCount = (position * totalFactionTurns) / totalInitiativeTurnCount;
			const fairnessDeviation = turnsTaken - expectedTurnCount;
			const nextInitiative = remainingFactionTurns[0].initiative;

			return nextInitiative - fairnessWeight * fairnessDeviation;
		}

		return { totalTurns: totalFactionTurns, priority, takeNextTurn, hasRemainingTurns };
	});

	function hasRemainingTurns() {
		return factions.some((faction) => faction.hasRemainingTurns());
	}
	const initiativeTurns: StableId[] = [];
	while (hasRemainingTurns()) {
		const sortedTurnCount = initiativeTurns.length;
		const nextTurn = [
			...factions.map((faction) => ({
				priority: faction.priority(sortedTurnCount),
				takeTurn: faction.takeNextTurn
			}))
		]
			.sort(({ priority: priorityA }, { priority: priorityB }) => priorityB - priorityA)[0]
			.takeTurn();
		if (nextTurn === undefined) break;
		initiativeTurns.push(nextTurn.id);
	}

	let pendingHooks = hookedTurns;
	while (pendingHooks.length > 0) {
		const deferredHooks: HookedTurn[] = [];

		for (const hook of pendingHooks) {
			let index: number;
			if (hook.kind === 'fixed-position') {
				index =
					hook.from === 'top' ? hook.position - 1 : initiativeTurns.length - hook.position + 1;
			} else {
				const targetIndex = initiativeTurns.indexOf(hook.targetTurnId);
				if (targetIndex === -1) {
					deferredHooks.push(hook);
					continue;
				}
				index =
					hook.relation === 'before'
						? targetIndex - hook.distance
						: targetIndex + 1 + hook.distance;
			}

			initiativeTurns.splice(clamp(index, 0, initiativeTurns.length), 0, hook.id);
		}

		if (deferredHooks.length === pendingHooks.length) {
			throw new TurnOrderError(deferredHooks.map((hook) => hook.id));
		}
		pendingHooks = deferredHooks;
	}

	return [
		...initiativeTurns.map((turnId): GeneratedTurnOrderEntry => ({ kind: 'turn', turnId })),
		{ kind: 'spawn' }
	];
}

/** Outcome of {@link prepareTurnOrder}. */
export type TurnOrderPreparation =
	| {
			/** The order was generated. */
			readonly status: 'generated';
			/** Generated play order of turn entries followed by the Spawn entry. */
			readonly order: GeneratedTurnOrder;
	  }
	| {
			/** Generation is blocked because rolling turns have no initiative result. */
			readonly status: 'missing-results';
			/** IDs of every rolling turn without a result, in setup order. */
			readonly turnIds: readonly StableId[];
	  }
	| {
			/** Generation failed because placement rules could not be resolved. */
			readonly status: 'placement-error';
			/** IDs of the turns whose placement could not be resolved, in setup order. */
			readonly turnIds: readonly StableId[];
	  };

/**
 * Generates a turn order only if every rolling turn has a result, reporting problems instead of throwing.
 * @param challenge Challenge whose creature turns, placement rules and fairness weight define the order.
 * @param initiativeResults Initiative values collected for rolling turns.
 * @returns The generated order, every rolling turn missing a result, or the turns with unresolvable placement.
 * @throws Any error other than {@link TurnOrderError} raised during generation.
 */
export function prepareTurnOrder(
	challenge: DeepReadonly<Challenge>,
	initiativeResults: Readonly<InitiativeResults>
): TurnOrderPreparation {
	const missingTurnIds = challenge.creatures.flatMap((creature) =>
		creature.turns
			.filter((turn) => turn.initiative.kind === 'roll' && initiativeResults[turn.id] === undefined)
			.map((turn) => turn.id)
	);
	if (missingTurnIds.length > 0) {
		return { status: 'missing-results', turnIds: missingTurnIds };
	}

	try {
		return { status: 'generated', order: generateTurnOrder(challenge, initiativeResults) };
	} catch (error) {
		if (error instanceof TurnOrderError) {
			return { status: 'placement-error', turnIds: error.turnIds };
		}
		throw error;
	}
}
