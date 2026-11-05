import type { DeepReadonly } from '../DeepReadonly';
import type { Challenge, ChallengeCreature, Faction, PlayerCharacter, StableId } from './model';

/** Display metadata associated with one configured challenge turn. */
export interface TurnDisplay {
	/** Creature that owns the turn. */
	readonly creature: DeepReadonly<ChallengeCreature>;
	/** Faction assigned to the creature, or undefined if its faction is missing. */
	readonly faction: DeepReadonly<Faction> | undefined;
	/** Creature name, with a turn number when the creature has multiple turns. */
	readonly label: string;
	/** Whether the creature's turns are hidden from read-only viewers. */
	readonly isHidden: boolean;
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
				label: creature.turns.length > 1 ? `${creatureName} - Turn ${index + 1}` : creatureName,
				isHidden: creature.isHidden
			});
		}
	}

	return lookup;
}
