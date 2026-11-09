import type { DeepReadonly } from '../../DeepReadonly';
import type { Challenge, ChallengeCreature, TurnInitiative } from '../core/model';

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
				...(initiative.index === undefined ? {} : { index: initiative.index }),
				targetTurnId: initiative.targetTurnId
			};
	}
}

function copyCreature(creature: DeepReadonly<ChallengeCreature>): ChallengeCreature {
	const turns = creature.turns.map((turn) => ({
		id: turn.id,
		initiative: copyInitiative(turn.initiative)
	}));

	if (creature.kind === 'character') {
		return {
			id: creature.id,
			kind: 'character',
			name: creature.name,
			...(creature.initiativeStat === undefined ? {} : { initiativeStat: creature.initiativeStat }),
			factionId: creature.factionId,
			isHidden: creature.isHidden,
			turns
		};
	}

	return {
		id: creature.id,
		kind: 'npc',
		creatureTypeId: creature.creatureTypeId,
		identifier: creature.identifier,
		factionId: creature.factionId,
		isHidden: creature.isHidden,
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
						...(challenge.runState.tieDecisions === undefined
							? {}
							: { tieDecisions: challenge.runState.tieDecisions.map((group) => [...group]) }),
						...(challenge.runState.spawnCount === undefined
							? {}
							: { spawnCount: challenge.runState.spawnCount }),
						...(challenge.runState.spawnEdit === undefined
							? {}
							: {
									spawnEdit: {
										newCreatureIds: [...challenge.runState.spawnEdit.newCreatureIds],
										newNpcTypeIds: [...challenge.runState.spawnEdit.newNpcTypeIds],
										newTurnIds: [...challenge.runState.spawnEdit.newTurnIds],
										lockedInitiativeTurnIds: [
											...challenge.runState.spawnEdit.lockedInitiativeTurnIds
										]
									}
								}),
						...(challenge.runState.generatedTurnOrder === undefined
							? {}
							: {
									generatedTurnOrder: challenge.runState.generatedTurnOrder.map((entry) => ({
										...entry
									}))
								})
					}
				})
	};
}
