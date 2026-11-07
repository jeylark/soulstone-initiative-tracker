import type { DeepReadonly } from '../../DeepReadonly';
import type { Challenge } from './model';
import type { ValidationIssue } from './validation';

/**
 * Finds initiative-stat problems that prevent a challenge from starting.
 * @param challenge Challenge setup whose NPC and character turns are checked.
 * @returns Every initiative-stat issue, with a data path and a message for the setup UI.
 */
export function validateChallengeSetup(
	challenge: DeepReadonly<Challenge>
): readonly ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const validInitiativeStat = (value: number | undefined): value is number =>
		typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

	challenge.npcTypes.forEach((npcType, index) => {
		if (!validInitiativeStat(npcType.initiativeStat)) {
			issues.push({
				path: `$.npcTypes[${index}].initiativeStat`,
				message: 'Initiative stat must be a positive whole number.'
			});
		}
	});

	challenge.creatures.forEach((creature, creatureIndex) => {
		if (creature.kind !== 'character') return;
		const hasAppRollTurn = creature.turns.some(
			(turn) => turn.initiative.kind === 'roll' && turn.initiative.mode === 'app'
		);
		if (!hasAppRollTurn) return;

		if (!validInitiativeStat(creature.initiativeStat)) {
			issues.push({
				path: `$.creatures[${creatureIndex}].initiativeStat`,
				message:
					creature.initiativeStat === undefined
						? 'An initiative stat is required for characters with app-rolled turns.'
						: 'Initiative stat must be a positive whole number.'
			});
		}
	});

	return issues;
}
