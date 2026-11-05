import type { DeepReadonly } from '../DeepReadonly';
import type { Challenge, ChallengeCreature, Faction, PlayerCharacter, StableId } from './model';

/** Display metadata associated with one configured challenge turn. */
export interface TurnDisplay {
	/** Creature that owns the turn. */
	readonly creature: DeepReadonly<ChallengeCreature>;
	/** Faction assigned to the creature, or undefined if its faction is missing. */
	readonly faction: DeepReadonly<Faction> | undefined;
	/** Creature name without a turn number suffix. */
	readonly creatureName: string;
	/** Creature name, with a turn number when the creature has multiple turns. */
	readonly label: string;
	/** Whether the creature's turns are hidden from read-only viewers. */
	readonly isHidden: boolean;
}

/** Display metadata and position for a turn in the generated order. */
export interface TurnOrderDisplayItem {
	/** Stable ID of the configured turn. */
	readonly turnId: StableId;
	/** One-based position in the original generated order. */
	readonly position: number;
	/** Creature and faction display metadata for the turn. */
	readonly display: TurnDisplay;
}

/** Renderable entries from a generated order and whether it contains unknown turn IDs. */
export interface TurnOrderDisplay {
	/** Known turns in generated order, retaining positions occupied by unknown IDs. */
	readonly items: readonly TurnOrderDisplayItem[];
	/** Whether any generated turn ID had no display metadata. */
	readonly hasUnknownTurnIds: boolean;
}

/**
 * Creates display metadata for every configured turn in a challenge.
 * @param challenge Challenge whose creature, faction, and NPC type data defines the display metadata.
 * @param characters Reusable player characters used to resolve character creature names.
 * @returns Read-only lookup of turn display metadata keyed by turn ID.
 */
export function createTurnDisplayLookup(
	challenge: DeepReadonly<Challenge>,
	characters: readonly DeepReadonly<PlayerCharacter>[]
): ReadonlyMap<StableId, TurnDisplay> {
	const lookup = new Map<StableId, TurnDisplay>();

	for (const creature of challenge.creatures) {
		let creatureName: string;
		if (creature.kind === 'character') {
			creatureName =
				characters.find((character) => character.id === creature.characterId)?.name ?? 'Character';
		} else {
			const typeName =
				challenge.npcTypes.find((npcType) => npcType.id === creature.creatureTypeId)?.name ?? 'NPC';
			creatureName = `${typeName} ${creature.identifier}`.trim();
		}

		const faction = challenge.factions.find((item) => item.id === creature.factionId);
		for (const [index, turn] of creature.turns.entries()) {
			lookup.set(turn.id, {
				creature,
				faction,
				creatureName,
				label: creature.turns.length > 1 ? `${creatureName} - Turn ${index + 1}` : creatureName,
				isHidden: creature.isHidden
			});
		}
	}

	return lookup;
}

/**
 * Filters an order to turns with display metadata while retaining saved positions.
 * @param generatedTurnOrder Turn IDs in their persisted generated order.
 * @param displayLookup Display metadata keyed by configured turn ID.
 * @returns Known turn display items and whether any turn IDs were unknown.
 */
export function createTurnOrderDisplay(
	generatedTurnOrder: readonly StableId[],
	displayLookup: ReadonlyMap<StableId, TurnDisplay>
): TurnOrderDisplay {
	let hasUnknownTurnIds = false;
	const items = generatedTurnOrder.flatMap((turnId, index) => {
		const display = displayLookup.get(turnId);
		if (!display) {
			hasUnknownTurnIds = true;
			return [];
		}
		return [{ turnId, position: index + 1, display }];
	});

	return { items, hasUnknownTurnIds };
}
