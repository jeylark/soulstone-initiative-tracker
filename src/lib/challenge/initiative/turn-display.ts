import type { DeepReadonly } from '../../DeepReadonly';
import type {
	Challenge,
	ChallengeCreature,
	Faction,
	GeneratedTurnOrder,
	InitiativeResults,
	StableId,
	Turn
} from '../core/model';

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
	/** Initiative configuration for this creature turn. */
	readonly initiative: Readonly<Turn['initiative']>;
	/** Whether the creature's turns are hidden from read-only viewers. */
	readonly isHidden: boolean;
}

/** Display metadata and position for a creature turn in the generated order. */
export interface TurnOrderTurnDisplayItem {
	/** Marks the item as a configured creature turn. */
	readonly kind: 'turn';
	/** Stable ID of the configured turn. */
	readonly turnId: StableId;
	/** One-based position in the original generated order. */
	readonly position: number;
	/** Creature and faction display metadata for the turn. */
	readonly display: TurnDisplay;
	/** Resolved numeric initiative, or undefined when a rolling result is missing. */
	readonly initiative: number | undefined;
}

/** Position of the Spawn step in the generated order. */
export interface TurnOrderSpawnDisplayItem {
	/** Marks the item as the Spawn step. */
	readonly kind: 'spawn';
	/** One-based position in the original generated order. */
	readonly position: number;
}

/** Renderable entry in the generated order: a creature turn or the Spawn step. */
export type TurnOrderDisplayItem = TurnOrderTurnDisplayItem | TurnOrderSpawnDisplayItem;

/** Minimal faction details needed to display one viewer-visible turn. */
export interface ViewerTurnFactionDisplay {
	/** Faction name shown as the turn-card title. */
	readonly name: string;
	/** Faction color used to tint the turn card. */
	readonly color: Faction['color'];
}

/** Display metadata retained for a viewer-visible turn. */
export interface ViewerTurnDisplay {
	/** Faction title and color, or undefined when the faction is missing. */
	readonly faction: ViewerTurnFactionDisplay | undefined;
	/** Creature label shown on the turn card. */
	readonly label: string;
	/** Whether the card should be styled as hidden; viewer entries are never hidden. */
	readonly isHidden: false;
}

/** Minimal display data for one viewer-visible turn. */
export interface ViewerTurnOrderTurnDisplayItem {
	/** Marks the item as a configured creature turn. */
	readonly kind: 'turn';
	/** Stable ID used to keep the displayed list item stable. */
	readonly turnId: StableId;
	/** Display-only creature and faction metadata. */
	readonly display: ViewerTurnDisplay;
	/** Resolved numeric initiative, or undefined when a rolling result is missing. */
	readonly initiative: number | undefined;
}

/** Display data for the Spawn step in a viewer turn order. */
export interface ViewerTurnOrderSpawnDisplayItem {
	/** Marks the item as the Spawn step. */
	readonly kind: 'spawn';
}

/** Minimal viewer-visible turn or Spawn entry. */
export type ViewerTurnOrderDisplayItem =
	ViewerTurnOrderTurnDisplayItem | ViewerTurnOrderSpawnDisplayItem;

/** Renderable entries from a generated order and whether it contains unknown turn IDs. */
export interface TurnOrderDisplay {
	/** Known turns and Spawn in generated order, retaining positions occupied by unknown IDs. */
	readonly items: readonly TurnOrderDisplayItem[];
	/** Whether any generated turn ID had no display metadata. */
	readonly hasUnknownTurnIds: boolean;
}

/**
 * Creates display metadata for every configured turn in a challenge.
 * @param challenge Challenge whose creature, faction, and NPC type data defines the display metadata.
 * @returns Read-only lookup of turn display metadata keyed by turn ID.
 */
export function createTurnDisplayLookup(
	challenge: DeepReadonly<Challenge>
): ReadonlyMap<StableId, TurnDisplay> {
	const lookup = new Map<StableId, TurnDisplay>();

	for (const creature of challenge.creatures) {
		let creatureName: string;
		if (creature.kind === 'character') {
			creatureName = creature.name;
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
				initiative: turn.initiative,
				isHidden: creature.isHidden
			});
		}
	}

	return lookup;
}

/**
 * Filters an order to turns with display metadata while retaining saved positions.
 * @param generatedTurnOrder Entries in their persisted generated order.
 * @param displayLookup Display metadata keyed by configured turn ID.
 * @param initiativeResults Saved roll results keyed by configured turn ID.
 * @returns Known turn and Spawn display items, and whether any turn IDs were unknown.
 */
export function createTurnOrderDisplay(
	generatedTurnOrder: DeepReadonly<GeneratedTurnOrder>,
	displayLookup: ReadonlyMap<StableId, TurnDisplay>,
	initiativeResults: Readonly<InitiativeResults> = {}
): TurnOrderDisplay {
	let hasUnknownTurnIds = false;
	const items = generatedTurnOrder.flatMap((entry, index): TurnOrderDisplayItem[] => {
		const position = index + 1;
		if (entry.kind === 'spawn') return [{ kind: 'spawn', position }];

		const display = displayLookup.get(entry.turnId);
		if (!display) {
			hasUnknownTurnIds = true;
			return [];
		}
		return [
			{
				kind: 'turn',
				turnId: entry.turnId,
				position,
				display,
				initiative:
					display.initiative.kind === 'static'
						? display.initiative.value
						: initiativeResults[entry.turnId]
			}
		];
	});

	return { items, hasUnknownTurnIds };
}
