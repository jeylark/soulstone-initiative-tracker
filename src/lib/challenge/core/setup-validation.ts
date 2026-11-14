import type { DeepReadonly } from '../../DeepReadonly';
import { CHALLENGE_FORMAT_VERSION, type Challenge } from './model';
import { validateChallengeLibrary, type ValidationIssue } from './validation';

/**
 * Collects all current setup and saved-data errors for an editable challenge.
 * @param challenge Structurally readable challenge whose fields and references may be invalid.
 * @returns Live blocking issues with challenge-relative paths, preferring existing inline Setup messages.
 */
export function getChallengeSetupIssues(
	challenge: DeepReadonly<Challenge>
): readonly ValidationIssue[] {
	const issues = [...validateChallengeSetup(challenge)];
	const result = validateChallengeLibrary({
		formatVersion: CHALLENGE_FORMAT_VERSION,
		challenges: [challenge]
	});
	if (!result.isValid) {
		for (const issue of result.issues) {
			const path = issue.path.replace('$.challenges[0]', '$');
			if (!issues.some((existing) => existing.path === path)) issues.push({ ...issue, path });
		}
	}
	return issues;
}

type NamedValue = {
	readonly path: string;
	readonly value: string;
};

type RelativeTurn = {
	readonly id: string;
	readonly path: string;
	readonly relation: 'before' | 'after';
	readonly index?: number;
	readonly targetTurnId: string;
};

function normalizedName(value: string): string {
	return value.trim().toLowerCase();
}

function addBlankNameIssues(values: readonly NamedValue[], label: string): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	for (const { path, value } of values) {
		if (value.trim().length === 0) {
			issues.push({ path, message: `${label} must not be blank.` });
		}
	}
	return issues;
}

function addDuplicateNameIssues(values: readonly NamedValue[], message: string): ValidationIssue[] {
	const counts = new Map<string, number>();
	for (const { value } of values) {
		const name = normalizedName(value);
		if (name.length === 0) continue;
		counts.set(name, (counts.get(name) ?? 0) + 1);
	}
	return values.flatMap(({ path, value }) => {
		const name = normalizedName(value);
		return name.length > 0 && counts.get(name)! > 1 ? [{ path, message }] : [];
	});
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
 * An NPC identifier may be blank only when that NPC is the sole creature of its NPC type.
 * @param challenge Challenge setup whose names, initiative values, and placement rules are checked.
 * @returns Every blocking setup issue, with a data path and a message for the setup UI.
 */
export function validateChallengeSetup(
	challenge: DeepReadonly<Challenge>
): readonly ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const validInitiativeStat = (value: number | undefined): value is number =>
		typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
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

	issues.push(...addBlankNameIssues(challengeName, 'Challenge name'));
	issues.push(...addBlankNameIssues(factionNames, 'Faction name'));
	issues.push(...addBlankNameIssues(npcTypeNames, 'NPC type name'));
	issues.push(...addBlankNameIssues(characterNames, 'Character name'));
	const npcCountByType = new Map<string, number>();
	for (const { creatureTypeId } of npcIdentifiers) {
		npcCountByType.set(creatureTypeId, (npcCountByType.get(creatureTypeId) ?? 0) + 1);
	}
	// A sole NPC of its type may omit its identifier.
	issues.push(
		...addBlankNameIssues(
			npcIdentifiers.filter(({ creatureTypeId }) => npcCountByType.get(creatureTypeId)! > 1),
			'NPC identifier'
		)
	);
	issues.push(
		...addDuplicateNameIssues(
			factionNames,
			'Faction names must be unique.'
		)
	);
	issues.push(
		...addDuplicateNameIssues(
			[...characterNames, ...npcTypeNames],
			'PC and NPC type names must be unique'
		)
	);
	for (const creatureTypeId of new Set(
		npcIdentifiers.map(({ creatureTypeId }) => creatureTypeId)
	)) {
		issues.push(
			...addDuplicateNameIssues(
				npcIdentifiers
					.filter((item) => item.creatureTypeId === creatureTypeId)
					.map(({ path, value }) => ({ path, value })),
				'NPC identifiers must be unique within each type.'
			)
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
				message: 'Initiative must be a non-negative whole number.'
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
							? 'Initiative is required.'
							: 'Initiative must be a non-negative whole number.'
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
							relation: turn.initiative.relation,
							...(turn.initiative.index === undefined ? {} : { index: turn.initiative.index }),
							targetTurnId: turn.initiative.targetTurnId
						}
					]
				: []
		)
	);
	const indexIssuePaths = new Set<string>();
	function addIndexIssue(path: string, message: string): void {
		const indexPath = `${path}.index`;
		if (indexIssuePaths.has(indexPath)) return;
		indexIssuePaths.add(indexPath);
		issues.push({ path: indexPath, message });
	}
	const relativeGroups = new Map<string, RelativeTurn[]>();
	for (const turn of relativeTurns) {
		if (turn.index !== undefined && (!Number.isSafeInteger(turn.index) || turn.index < 1)) {
			addIndexIssue(turn.path, 'Index must be a positive whole number.');
		}
		const key = JSON.stringify([turn.targetTurnId, turn.relation]);
		const group = relativeGroups.get(key) ?? [];
		group.push(turn);
		relativeGroups.set(key, group);
	}
	for (const group of relativeGroups.values()) {
		if (group.length < 2) continue;
		const indices = group.map(({ index }) => index);
		const hasContiguousIndices =
			indices.every((index): index is number => Number.isSafeInteger(index) && index! > 0) &&
			new Set(indices).size === group.length &&
			Math.min(...indices) === 1 &&
			Math.max(...indices) === group.length;
		if (!hasContiguousIndices) {
			for (const turn of group) {
				addIndexIssue(turn.path, 'Multiple hooks need unique, contiguous indices starting at 1.');
			}
		}
	}
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
