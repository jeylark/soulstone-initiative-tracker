import type {
	Challenge,
	GeneratedTurnOrder,
	GeneratedTurnOrderEntry,
	InitiativeResults,
	StableId
} from '../core/model';
import type { DeepReadonly } from '../../DeepReadonly';

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

/** Ordered turn IDs chosen by the DM for one group of tied turns. */
export type TieDecision = readonly StableId[];

function sameMembers(a: readonly StableId[], b: readonly StableId[]): boolean {
	return a.length === b.length && a.every((id) => b.includes(id));
}

/**
 * Finds groups of turns in the same faction that have equal initiative.
 * Hooked turns and rolling turns without a result are ignored.
 * @param challenge Challenge whose creature turns define factions and static initiatives.
 * @param initiativeResults Initiative values collected for rolling turns.
 * @returns Each group of two or more tied turn IDs, in setup order.
 */
export function findInitiativeTies(
	challenge: DeepReadonly<Challenge>,
	initiativeResults: Readonly<InitiativeResults>
): StableId[][] {
	const [turnsByFaction] = filterFactionTurns(challenge, initiativeResults);
	const ties: StableId[][] = [];
	for (const factionTurns of turnsByFaction.values()) {
		const groups = new Map<number, StableId[]>();
		for (const turn of factionTurns) {
			let group = groups.get(turn.initiative);
			if (!group) {
				group = [];
				groups.set(turn.initiative, group);
			}
			group.push(turn.id);
		}
		ties.push(...groups.values().filter((group) => group.length > 1));
	}
	return ties;
}

/**
 * Finds tie groups that none of the decisions orders.
 * A decision resolves a group only when it contains exactly the group's turns.
 * @param challenge Challenge whose creature turns define factions and static initiatives.
 * @param initiativeResults Initiative values collected for rolling turns.
 * @param tieDecisions Orders the DM chose for tied groups.
 * @returns Each unresolved group of tied turn IDs, in setup order.
 */
export function findUnresolvedTies(
	challenge: DeepReadonly<Challenge>,
	initiativeResults: Readonly<InitiativeResults>,
	tieDecisions: readonly TieDecision[] = []
): StableId[][] {
	return findInitiativeTies(challenge, initiativeResults).filter(
		(group) => !tieDecisions.some((decision) => sameMembers(decision, group))
	);
}

/**
 * Drops decisions that no longer match a current tie group.
 * @param challenge Challenge whose creature turns define factions and static initiatives.
 * @param initiativeResults Initiative values collected for rolling turns.
 * @param tieDecisions Orders the DM chose for tied groups.
 * @returns The decisions whose members exactly match a current tie group.
 */
export function pruneTieDecisions(
	challenge: DeepReadonly<Challenge>,
	initiativeResults: Readonly<InitiativeResults>,
	tieDecisions: readonly TieDecision[]
): StableId[][] {
	const ties = findInitiativeTies(challenge, initiativeResults);
	return tieDecisions
		.filter((decision) => ties.some((group) => sameMembers(decision, group)))
		.map((decision) => [...decision]);
}

/**
 * Drops the decisions for every tie group containing a turn, as when the turn is rerolled.
 * @param tieDecisions Orders the DM chose for tied groups.
 * @param turnId ID of the turn whose groups lose their decisions.
 * @returns The remaining decisions.
 */
export function discardTieDecisionsForTurn(
	tieDecisions: readonly TieDecision[],
	turnId: StableId
): StableId[][] {
	return tieDecisions.filter((decision) => !decision.includes(turnId)).map((d) => [...d]);
}

function filterFactionTurns(
	challenge: DeepReadonly<Challenge>,
	initiativeResults: Readonly<InitiativeResults>
): [Map<StableId, InitiativeTurn[]>, HookedTurn[]] {
	const turnsByFaction: Map<StableId, InitiativeTurn[]> = new Map();
	const hookedTurns: HookedTurn[] = [];

	for (const creature of challenge.creatures) {
		let factionTurns = turnsByFaction.get(creature.factionId);
		if (!factionTurns) {
			factionTurns = [];
			turnsByFaction.set(creature.factionId, factionTurns);
		}

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
 * @param tieDecisions Orders chosen by the DM for tied same-faction turns; tied turns without a decision keep setup order.
 * @returns Generated play order of turn entries followed by the Spawn entry.
 * @throws {TurnOrderError} If a relative placement targets a turn that is missing from the order or the placements form a cycle.
 */
export function generateTurnOrder(
	challenge: DeepReadonly<Challenge>,
	initiativeResults: Readonly<InitiativeResults>,
	tieDecisions: readonly TieDecision[] = []
): GeneratedTurnOrder {
	return generateTurnOrderWithWarnings(challenge, initiativeResults, tieDecisions).order;
}

function generateTurnOrderWithWarnings(
	challenge: DeepReadonly<Challenge>,
	initiativeResults: Readonly<InitiativeResults>,
	tieDecisions: readonly TieDecision[]
): { readonly order: GeneratedTurnOrder; readonly clampedTurnIds: readonly StableId[] } {
	const { fairnessWeight } = challenge;
	const tieRank = new Map<StableId, number>();
	for (const decision of pruneTieDecisions(challenge, initiativeResults, tieDecisions)) {
		decision.forEach((id, index) => tieRank.set(id, index));
	}
	const [turnsByFaction, hookedTurns] = filterFactionTurns(challenge, initiativeResults);

	const totalInitiativeTurnCount = turnsByFaction
		.values()
		.reduce((sum, factionTurns) => sum + factionTurns.length, 0);
	const factions = [...turnsByFaction.values()].map((factionTurns) => {
		const totalFactionTurns = factionTurns.length;
		const remainingFactionTurns = factionTurns.toSorted(
			(a, b) => b.initiative - a.initiative || (tieRank.get(a.id) ?? 0) - (tieRank.get(b.id) ?? 0)
		);

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
	const clampedTurnIds: StableId[] = [];
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

			const clampedIndex = clamp(index, 0, initiativeTurns.length);
			if (clampedIndex !== index) clampedTurnIds.push(hook.id);
			initiativeTurns.splice(clampedIndex, 0, hook.id);
		}

		if (deferredHooks.length === pendingHooks.length) {
			throw new TurnOrderError(deferredHooks.map((hook) => hook.id));
		}
		pendingHooks = deferredHooks;
	}

	return {
		order: [
			...initiativeTurns.map((turnId): GeneratedTurnOrderEntry => ({ kind: 'turn', turnId })),
			{ kind: 'spawn' }
		],
		clampedTurnIds
	};
}

/** Outcome of {@link prepareTurnOrder}. */
export type TurnOrderPreparation =
	| {
			/** The order was generated. */
			readonly status: 'generated';
			/** Generated play order of turn entries followed by the Spawn entry. */
			readonly order: GeneratedTurnOrder;
			/** Turn IDs whose fixed or relative placement was clamped to the available order bounds. */
			readonly clampedTurnIds: readonly StableId[];
	  }
	| {
			/** Generation is blocked because rolling turns have no initiative result. */
			readonly status: 'missing-results';
			/** IDs of every rolling turn without a result, in setup order. */
			readonly turnIds: readonly StableId[];
	  }
	| {
			/** Generation is blocked because same-faction turns with equal initiative are not ordered. */
			readonly status: 'unresolved-ties';
			/** Each unresolved group of tied turn IDs, in setup order. */
			readonly groups: readonly (readonly StableId[])[];
	  }
	| {
			/** Generation failed because placement rules could not be resolved. */
			readonly status: 'placement-error';
			/** IDs of the turns whose placement could not be resolved, in setup order. */
			readonly turnIds: readonly StableId[];
	  };

/**
 * Generates a turn order only if every rolling turn has a result and every same-faction tie is resolved, reporting problems instead of throwing.
 * @param challenge Challenge whose creature turns, placement rules and fairness weight define the order.
 * @param initiativeResults Initiative values collected for rolling turns.
 * @param tieDecisions Orders chosen by the DM for tied same-faction turns.
 * @returns The generated order, every rolling turn missing a result, the unresolved tie groups, or the turns with unresolvable placement.
 * @throws Any error other than {@link TurnOrderError} raised during generation.
 */
export function prepareTurnOrder(
	challenge: DeepReadonly<Challenge>,
	initiativeResults: Readonly<InitiativeResults>,
	tieDecisions: readonly TieDecision[] = []
): TurnOrderPreparation {
	const missingTurnIds = challenge.creatures.flatMap((creature) =>
		creature.turns
			.filter((turn) => turn.initiative.kind === 'roll' && initiativeResults[turn.id] === undefined)
			.map((turn) => turn.id)
	);
	if (missingTurnIds.length > 0) {
		return { status: 'missing-results', turnIds: missingTurnIds };
	}

	const unresolvedTies = findUnresolvedTies(challenge, initiativeResults, tieDecisions);
	if (unresolvedTies.length > 0) {
		return { status: 'unresolved-ties', groups: unresolvedTies };
	}

	try {
		const generated = generateTurnOrderWithWarnings(challenge, initiativeResults, tieDecisions);
		return {
			status: 'generated',
			order: generated.order,
			clampedTurnIds: generated.clampedTurnIds
		};
	} catch (error) {
		if (error instanceof TurnOrderError) {
			return { status: 'placement-error', turnIds: error.turnIds };
		}
		throw error;
	}
}
