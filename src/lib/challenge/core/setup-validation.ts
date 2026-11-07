import type { DeepReadonly } from '../../DeepReadonly';
import type { Challenge } from './model';
import type { ValidationIssue } from './validation';

type NamedValue = {
	readonly path: string;
	readonly value: string;
};

type RelativeTurn = {
	readonly id: string;
	readonly path: string;
	readonly targetTurnId: string;
};

function normalizedName(value: string): string {
	return value.trim().toLowerCase();
}

function addBlankNameIssues(
	values: readonly NamedValue[],
	label: string,
	issues: ValidationIssue[]
): void {
	for (const { path, value } of values) {
		if (value.trim().length === 0) {
			issues.push({ path, message: `${label} must not be blank.` });
		}
	}
}

function addDuplicateNameIssues(
	values: readonly NamedValue[],
	message: string,
	issues: ValidationIssue[]
): void {
	const seen = new Set<string>();
	for (const { path, value } of values) {
		const name = normalizedName(value);
		if (name.length === 0) continue;
		if (seen.has(name)) {
			issues.push({ path, message });
		} else {
			seen.add(name);
		}
	}
}

function getCyclicTurns(turns: readonly RelativeTurn[]): ReadonlySet<string> {
	const targetByTurnId = new Map(turns.map(({ id, targetTurnId }) => [id, targetTurnId]));
	const stateByTurnId = new Map<string, 'visiting' | 'visited'>();
	const stack: string[] = [];
	const cyclicTurnIds = new Set<string>();

	function visit(turnId: string): void {
		stateByTurnId.set(turnId, 'visiting');
		stack.push(turnId);
		const targetTurnId = targetByTurnId.get(turnId);
		if (targetTurnId && targetByTurnId.has(targetTurnId)) {
			const targetState = stateByTurnId.get(targetTurnId);
			if (targetState === 'visiting') {
				const cycleStart = stack.indexOf(targetTurnId);
				for (const cyclicTurnId of stack.slice(cycleStart)) cyclicTurnIds.add(cyclicTurnId);
			} else if (targetState === undefined) {
				visit(targetTurnId);
			}
		}
		stack.pop();
		stateByTurnId.set(turnId, 'visited');
	}

	for (const { id } of turns) {
		if (stateByTurnId.get(id) === undefined) visit(id);
	}
	return cyclicTurnIds;
}

/**
 * Finds setup values that prevent a challenge from starting.
 * @param challenge Challenge setup whose names, initiative values, and placement rules are checked.
 * @returns Every blocking setup issue, with a data path and a message for the setup UI.
 */
export function validateChallengeSetup(
	challenge: DeepReadonly<Challenge>
): readonly ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const validInitiativeStat = (value: number | undefined): value is number =>
		typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
	const challengeName = [{ path: '$.name', value: challenge.name }];
	const factionNames = challenge.factions.map((faction, index) => ({
		path: `$.factions[${index}].name`,
		value: faction.name
	}));
	const npcTypeNames = challenge.npcTypes.map((npcType, index) => ({
		path: `$.npcTypes[${index}].name`,
		value: npcType.name
	}));
	const characterNames = challenge.creatures.flatMap((creature, index) =>
		creature.kind === 'character'
			? [{ path: `$.creatures[${index}].name`, value: creature.name }]
			: []
	);
	const npcIdentifiers = challenge.creatures.flatMap((creature, index) =>
		creature.kind === 'npc'
			? [
					{
						path: `$.creatures[${index}].identifier`,
						value: creature.identifier,
						creatureTypeId: creature.creatureTypeId
					}
				]
			: []
	);

	addBlankNameIssues(challengeName, 'Challenge name', issues);
	addBlankNameIssues(factionNames, 'Faction name', issues);
	addBlankNameIssues(npcTypeNames, 'NPC type name', issues);
	addBlankNameIssues(characterNames, 'Character name', issues);
	addBlankNameIssues(npcIdentifiers, 'NPC identifier', issues);
	addDuplicateNameIssues(
		factionNames,
		'Faction names must be unique, ignoring case and surrounding whitespace.',
		issues
	);
	addDuplicateNameIssues(
		[...characterNames, ...npcTypeNames],
		'Player-character and NPC type names must be unique, ignoring case and surrounding whitespace.',
		issues
	);
	for (const creatureTypeId of new Set(
		npcIdentifiers.map(({ creatureTypeId }) => creatureTypeId)
	)) {
		addDuplicateNameIssues(
			npcIdentifiers
				.filter((item) => item.creatureTypeId === creatureTypeId)
				.map(({ path, value }) => ({ path, value })),
			'NPC identifiers must be unique within each NPC type, ignoring case and surrounding whitespace.',
			issues
		);
	}

	if (!Number.isFinite(challenge.fairnessWeight) || challenge.fairnessWeight < 0) {
		issues.push({
			path: '$.fairnessWeight',
			message: 'Fairness weight must be a non-negative number.'
		});
	}

	challenge.npcTypes.forEach((npcType, index) => {
		if (!validInitiativeStat(npcType.initiativeStat)) {
			issues.push({
				path: `$.npcTypes[${index}].initiativeStat`,
				message: 'Initiative stat must be a positive whole number.'
			});
		}
	});

	challenge.creatures.forEach((creature, creatureIndex) => {
		if (creature.kind === 'character') {
			const hasAppRollTurn = creature.turns.some(
				(turn) => turn.initiative.kind === 'roll' && turn.initiative.mode === 'app'
			);
			if (hasAppRollTurn && !validInitiativeStat(creature.initiativeStat)) {
				issues.push({
					path: `$.creatures[${creatureIndex}].initiativeStat`,
					message:
						creature.initiativeStat === undefined
							? 'An initiative stat is required for characters with app-rolled turns.'
							: 'Initiative stat must be a positive whole number.'
				});
			}
		}

		creature.turns.forEach((turn, turnIndex) => {
			const path = `$.creatures[${creatureIndex}].turns[${turnIndex}].initiative`;
			if (
				turn.initiative.kind === 'fixed-position' &&
				(!Number.isSafeInteger(turn.initiative.position) || turn.initiative.position < 1)
			) {
				issues.push({
					path: `${path}.position`,
					message: 'Position must be a positive whole number.'
				});
			} else if (
				turn.initiative.kind === 'relative-position' &&
				(!Number.isSafeInteger(turn.initiative.distance) || turn.initiative.distance < 0)
			) {
				issues.push({
					path: `${path}.distance`,
					message: 'Distance must be a non-negative whole number.'
				});
			}
		});
	});

	const relativeTurns = challenge.creatures.flatMap((creature, creatureIndex) =>
		creature.turns.flatMap((turn, turnIndex) =>
			turn.initiative.kind === 'relative-position'
				? [
						{
							id: turn.id,
							path: `$.creatures[${creatureIndex}].turns[${turnIndex}].initiative`,
							targetTurnId: turn.initiative.targetTurnId
						}
					]
				: []
		)
	);
	const relativeTurnPaths = new Map<string, string>(
		relativeTurns.map(({ id, path }) => [id, path])
	);
	for (const turnId of getCyclicTurns(relativeTurns)) {
		issues.push({
			path: relativeTurnPaths.get(turnId) ?? '$.creatures',
			message: 'Relative placement contains a cycle.'
		});
	}

	return issues;
}
