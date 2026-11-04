import type { Challenge, ChallengeCreature, TurnInitiative } from './model';

/**
 * Recursively marks a value and its nested properties as readonly.
 * @typeParam T Type whose nested properties should be readonly.
 */
export type DeepReadonly<T> = T extends readonly (infer U)[]
	? readonly DeepReadonly<U>[]
	: T extends Date
		? Date
		: T extends object
			? { readonly [K in keyof T]: DeepReadonly<T[K]> }
			: T;

function copyInitiative(initiative: DeepReadonly<TurnInitiative>): TurnInitiative {
	switch (initiative.kind) {
		case 'roll':
			return { kind: 'roll', mode: initiative.mode };
		case 'static':
			return { kind: 'static', value: initiative.value };
		case 'fixed-position':
			return {
				kind: 'fixed-position',
				from: initiative.from,
				position: initiative.position
			};
		case 'relative-position':
			return {
				kind: 'relative-position',
				relation: initiative.relation,
				distance: initiative.distance,
				targetTurnId: initiative.targetTurnId
			};
	}
}

function copyCreature(creature: DeepReadonly<ChallengeCreature>): ChallengeCreature {
	const turns = creature.turns.map((turn) => ({
		id: turn.id,
		isHidden: turn.isHidden,
		initiative: copyInitiative(turn.initiative)
	}));

	if (creature.kind === 'character') {
		return {
			id: creature.id,
			kind: 'character',
			characterId: creature.characterId,
			factionId: creature.factionId,
			turns
		};
	}

	return {
		id: creature.id,
		kind: 'npc',
		creatureTypeId: creature.creatureTypeId,
		identifier: creature.identifier,
		factionId: creature.factionId,
		turns
	};
}

/**
 * Copies a challenge using only modeled fields, including its resumable run state.
 * @param challenge Challenge to sanitize and copy.
 * @returns An independent mutable copy containing only fields in the challenge model.
 */
export function sanitizeChallenge(challenge: DeepReadonly<Challenge>): Challenge {
	return {
		id: challenge.id,
		name: challenge.name,
		createdAt: new Date(challenge.createdAt.getTime()),
		updatedAt: new Date(challenge.updatedAt.getTime()),
		factions: challenge.factions.map(({ id, name, color }) => ({ id, name, color })),
		npcTypes: challenge.npcTypes.map(({ id, name, initiativeStat }) => ({
			id,
			name,
			initiativeStat
		})),
		fairnessWeight: challenge.fairnessWeight,
		creatures: challenge.creatures.map(copyCreature),
		...(challenge.runState === undefined
			? {}
			: {
					runState: {
						initiativeResults: { ...challenge.runState.initiativeResults },
						...(challenge.runState.generatedTurnOrder === undefined
							? {}
							: { generatedTurnOrder: [...challenge.runState.generatedTurnOrder] })
					}
				})
	};
}
