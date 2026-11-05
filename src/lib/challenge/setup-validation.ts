import type { DeepReadonly } from '../DeepReadonly';
import type { Challenge, PlayerCharacter } from './model';
import type { ValidationIssue } from './validation';

/**
 * Finds initiative-stat problems that prevent a challenge from starting.
 * @param challenge Challenge setup whose NPC and character turns are checked.
 * @param characters Reusable characters referenced by the challenge.
 * @returns Every initiative-stat issue, with a data path and a message for the setup UI.
 */
export function validateChallengeSetup(
	challenge: DeepReadonly<Challenge>,
	characters: DeepReadonly<PlayerCharacter[]>
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

	characters.forEach((character, characterIndex) => {
		const hasAppRollTurn = challenge.creatures.some(
			(creature) =>
				creature.kind === 'character' &&
				creature.characterId === character.id &&
				creature.turns.some(
					(turn) => turn.initiative.kind === 'roll' && turn.initiative.mode === 'app'
				)
		);
		if (character.initiativeStat === undefined && !hasAppRollTurn) return;

		if (!validInitiativeStat(character.initiativeStat)) {
			issues.push({
				path: `$.characters[${characterIndex}].initiativeStat`,
				message:
					character.initiativeStat === undefined && hasAppRollTurn
						? 'An initiative stat is required for characters with app-rolled turns.'
						: 'Initiative stat must be a positive whole number.'
			});
		}
	});

	return issues;
}
