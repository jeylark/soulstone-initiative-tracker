import type { Challenge, GeneratedTurnOrder, InitiativeResults, StableId } from './model';
import type { DeepReadonly } from './challenge-copy';

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

function filterFactionTurns(
	challenge: DeepReadonly<Challenge>,
	initiativeResults: Readonly<InitiativeResults>
): [Map<StableId, InitiativeTurn[]>, HookedTurn[]] {
	const turnsByFaction: Map<StableId, InitiativeTurn[]> = new Map();
	const hookedTurns: HookedTurn[] = [];

	for (const creature of challenge.creatures) {
		const factionTurns = turnsByFaction.getOrInsert(creature.factionId, []);

		for (const turn of creature.turns) {
			if (turn.initiative === null) {
				continue;
			}

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
 * @param challenge Challenge whose creature turns and placement rules define the order.
 * @param initiativeResults Initiative values collected for rolling turns.
 * @param fairnessWeight Weighting factor for fairness in turn order. Higher values prioritize fairness in faction distribution over initiative.
 * 0	Pure value-based merge
 * 1	Value has strong influence
 * 3	Balanced approach
 * 5	Stronger distribution fairness
 * 10+	Nearly proportional round-robin
 * @returns Turn IDs in generated play order.
 * @throws {Error} Until turn-order generation is implemented.
 */
export function generateTurnOrder(
	challenge: DeepReadonly<Challenge>,
	initiativeResults: Readonly<InitiativeResults>,
	fairnessWeight: number
): GeneratedTurnOrder {
	const [turnsByFaction, hookedTurns] = filterFactionTurns(challenge, initiativeResults);

	const totalInitiativeTurnCount = turnsByFaction
		.values()
		.reduce((sum, factionTurns) => sum + factionTurns.length, 0);
	const factions = turnsByFaction.values().map((factionTurns) => {
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
		initiativeTurns.push(nextTurn?.id ?? '----');
	}

	let firstUnhookableTurn: StableId | null = null;
	while (hookedTurns.length > 0) {
		const hookedTurn = hookedTurns.shift();
		if (hookedTurn === undefined) {
			break;
		}

		function putBack(turn: HookedTurn) {
			if (firstUnhookableTurn === turn.id) {
				initiativeTurns.push(turn.id);
				let nextHookedTurn = hookedTurns.shift();
				while (nextHookedTurn !== undefined) {
					initiativeTurns.push(nextHookedTurn.id);
					nextHookedTurn = hookedTurns.shift();
				}
			}

			firstUnhookableTurn = turn.id;
			hookedTurns.push(turn);
		}

		if (hookedTurn.kind === 'fixed-position') {
			const position = hookedTurn.position;
			const index = hookedTurn.from === 'top' ? position : initiativeTurns.length - position;
			if (index < 0 || index > initiativeTurns.length) {
				putBack(hookedTurn);
				continue;
			}

			initiativeTurns.splice(index, 0, hookedTurn.id);
			firstUnhookableTurn = null;
			continue;
		}

		if (hookedTurn.kind === 'relative-position') {
			const targetTurnIndex = initiativeTurns.indexOf(hookedTurn.targetTurnId);
			const index =
				hookedTurn.relation === 'before'
					? targetTurnIndex - hookedTurn.distance
					: targetTurnIndex + hookedTurn.distance;
			if (targetTurnIndex === -1 || index < 0 || index > initiativeTurns.length) {
				putBack(hookedTurn);
				continue;
			}

			initiativeTurns.splice(index, 0, hookedTurn.id);
			firstUnhookableTurn = null;
			continue;
		}
	}

	return initiativeTurns;
}
