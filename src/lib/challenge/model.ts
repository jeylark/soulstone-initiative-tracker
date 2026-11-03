import type { UUID as Uuid } from 'node:crypto';

/** Current schema version for exported or persisted challenge libraries. */
export const CHALLENGE_FORMAT_VERSION = 1 as const;

/** UUID used to identify a saved entity or reference in the challenge model. */
export type StableId = Uuid;

/** Rolled initiative values, keyed by turn ID; turns without a result are omitted. */
export type InitiativeResults = Partial<Record<StableId, number>>;

/** Turn IDs in their generated play order. */
export type GeneratedTurnOrder = StableId[];

/** Saved progress from initiative collection and turn-order generation. */
export interface ChallengeRunState {
	/** Initiative values already collected for turns configured to roll. */
	initiativeResults: InitiativeResults;
	/** Generated order of turns, when one has been created. */
	generatedTurnOrder?: GeneratedTurnOrder;
}

/** Persistent library containing reusable characters and saved challenges. */
export interface ChallengeLibrary {
	/** Schema version used to interpret this library's data. */
	formatVersion: typeof CHALLENGE_FORMAT_VERSION;
	/** Characters available for reuse across challenges. */
	characters: PlayerCharacter[];
	/** Challenges saved in this library. */
	challenges: Challenge[];
}

/** Reusable player character referenced by character creatures. */
export interface PlayerCharacter {
	/** Unique character identifier. */
	id: StableId;
	/** Character's display name. */
	name: string;
}

/** Group used to organize creatures in a challenge's turn order. */
export interface Faction {
	/** Unique faction identifier. */
	id: StableId;
	/** Faction's display name. */
	name: string;
}

/** Reusable NPC definition, including the stat used for app initiative rolls. */
export interface NpcType {
	/** Unique NPC type identifier. */
	id: StableId;
	/** NPC type's display name. */
	name: string;
	/** Number of d6 rolled when the app calculates this NPC's initiative. */
	initiativeStat: number;
}

/** A creature's individual turn and its visibility and initiative setup. */
export interface Turn {
	/** Unique turn identifier, also used to associate initiative results. */
	id: StableId;
	/** Whether the turn is hidden from read-only viewers. */
	isHidden: boolean;
	/** How this turn is placed in the order, or null when it has no initiative. */
	initiative: TurnInitiative | null;
}

/** Initiative rule that determines a turn's placement in the generated order. */
export type TurnInitiative =
	| {
			/** Roll or enter an initiative value for this turn. */
			kind: 'roll';
	  }
	| {
			/** Use a predetermined initiative value for this turn. */
			kind: 'static';
			/** Initiative value used to order the turn. */
			value: number;
	  }
	| {
			/** Place the turn at a fixed position after the initiative list is ordered. */
			kind: 'fixed-position';
			/** End of the ordered list from which the position is counted. */
			from: 'top' | 'bottom';
			/** One-based position from the selected end of the list. */
			position: number;
	  }
	| {
			/** Place the turn at an offset from another turn after the list is ordered. */
			kind: 'relative-position';
			/** Whether this turn is placed before or after its target. */
			relation: 'before' | 'after';
			/** Number of positions between this turn and its target. */
			distance: number;
			/** ID of the turn that determines this turn's relative placement. */
			targetTurnId: StableId;
	  };

/** A challenge creature backed by a reusable player character. */
export interface CharacterCreature {
	/** Unique creature-instance identifier. */
	id: StableId;
	/** Discriminator identifying this as a character creature. */
	kind: 'character';
	/** ID of the reusable character represented by this creature. */
	characterId: StableId;
	/** ID of the faction this creature belongs to. */
	factionId: StableId;
	/** Turns taken by this creature in the challenge. */
	turns: Turn[];
}

/** An NPC instance backed by a reusable NPC type. */
export interface NpcCreature {
	/** Unique creature-instance identifier. */
	id: StableId;
	/** Discriminator identifying this as an NPC creature. */
	kind: 'npc';
	/** ID of the NPC type used by this creature. */
	creatureTypeId: StableId;
	/** Custom identifier distinguishing this NPC from others of the same type. */
	identifier: string;
	/** ID of the faction this creature belongs to. */
	factionId: StableId;
	/** Turns taken by this creature in the challenge. */
	turns: Turn[];
}

/** Either a character creature or an NPC creature participating in a challenge. */
export type ChallengeCreature = CharacterCreature | NpcCreature;

/** Saved challenge setup and, when present, its resumable run state. */
export interface Challenge {
	/** Unique challenge identifier. */
	id: StableId;
	/** Challenge's display name. */
	name: string;
	/** Date and time when the challenge was created or copied. */
	createdAt: Date;
	/** Date and time when the challenge was most recently modified. */
	updatedAt: Date;
	/** Factions available to creatures in this challenge. */
	factions: Faction[];
	/** NPC types available to NPC creatures in this challenge. */
	npcTypes: NpcType[];
	/** Non-negative weight balancing faction distribution against initiative when generating the turn order; 0 orders purely by initiative. */
	fairnessWeight: number;
	/** Character and NPC instances participating in this challenge. */
	creatures: ChallengeCreature[];
	/** Saved initiative results and generated order for resuming the challenge. */
	runState?: ChallengeRunState;
}
