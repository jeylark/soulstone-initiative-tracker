import { parseUuid } from './uuid';
import { isFactionColor } from './faction-colors';
import type {
	Challenge,
	ChallengeCreature,
	ChallengeLibrary,
	ChallengeRunState,
	CharacterCreature,
	Faction,
	GeneratedTurnOrderEntry,
	InitiativeRollMode,
	NpcCreature,
	NpcType,
	StableId,
	Turn,
	TurnInitiative
} from './model';

/** A validation problem associated with a location in the supplied data. */
export interface ValidationIssue {
	/** JSON-style path to the invalid value. */
	readonly path: string;
	/** Human-readable explanation of the problem. */
	readonly message: string;
}

/** Successful validation result containing the validated value. */
interface ValidValidationResult<T> {
	/** Discriminant that is `true` when validation succeeds. */
	readonly isValid: true;
	/** The input narrowed to the requested validated type. */
	readonly value: T;
}

/** Failed validation result containing all detected issues. */
interface InvalidValidationResult {
	/** Discriminant that is `false` when validation fails. */
	readonly isValid: false;
	/** Validation issues found in the supplied value. */
	readonly issues: readonly ValidationIssue[];
}

/**
 * Result of checking unknown data against a runtime model.
 * @typeParam T Type expected when validation succeeds.
 */
export type ValidationResult<T> = Readonly<ValidValidationResult<T> | InvalidValidationResult>;

type UnknownRecord = Readonly<Record<string, unknown>>;
type IssueRecorder = (path: string, message: string) => void;
type ValueValidator<T> = (value: unknown, path: string, addIssue: IssueRecorder) => value is T;

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createIssueFactory() {
	const issues: ValidationIssue[] = [];

	function addIssue(path: string, message: string): void {
		issues.push({ path, message });
	}

	function getIssues(): readonly ValidationIssue[] {
		return [...issues];
	}

	return { addIssue, getIssues };
}

function validateString(value: unknown, path: string, addIssue: IssueRecorder): value is string {
	if (typeof value === 'string') return true;
	addIssue(path, 'Expected a string.');
	return false;
}

function validateDate(value: unknown, path: string, addIssue: IssueRecorder): value is Date {
	if (value instanceof Date && Number.isFinite(value.getTime())) return true;
	addIssue(path, 'Expected a valid Date.');
	return false;
}

function validateStableId(
	value: unknown,
	path: string,
	addIssue: IssueRecorder
): value is StableId {
	if (typeof value === 'string' && parseUuid(value) !== null) return true;
	addIssue(path, 'Expected a valid UUID.');
	return false;
}

function validateGeneratedTurnOrderEntry(
	value: unknown,
	path: string,
	addIssue: IssueRecorder
): value is GeneratedTurnOrderEntry {
	if (!isRecord(value)) {
		addIssue(path, 'Expected a turn or spawn entry object.');
		return false;
	}
	if (value.kind === 'spawn') return true;
	if (value.kind === 'turn') return validateStableId(value.turnId, `${path}.turnId`, addIssue);
	addIssue(`${path}.kind`, "Expected 'turn' or 'spawn'.");
	return false;
}

function validateArray<T>(
	value: unknown,
	path: string,
	addIssue: IssueRecorder,
	validateItem: ValueValidator<T>
): value is T[] {
	if (!Array.isArray(value)) {
		addIssue(path, 'Expected an array.');
		return false;
	}

	let isValid = true;
	value.forEach((item, index) => {
		if (!validateItem(item, `${path}[${index}]`, addIssue)) isValid = false;
	});
	return isValid;
}

function validateCharacterDetails(
	value: UnknownRecord,
	path: string,
	addIssue: IssueRecorder
): boolean {
	const isValidName = validateString(value.name, `${path}.name`, addIssue);
	let isValidInitiativeStat = true;
	if (
		value.initiativeStat !== undefined &&
		(typeof value.initiativeStat !== 'number' || !Number.isFinite(value.initiativeStat))
	) {
		addIssue(`${path}.initiativeStat`, 'Expected a finite number.');
		isValidInitiativeStat = false;
	}
	return isValidName && isValidInitiativeStat;
}

function validateFaction(value: unknown, path: string, addIssue: IssueRecorder): value is Faction {
	if (!isRecord(value)) {
		addIssue(path, 'Expected a faction object.');
		return false;
	}

	const isValidId = validateStableId(value.id, `${path}.id`, addIssue);
	const isValidName = validateString(value.name, `${path}.name`, addIssue);
	const isValidColor = isFactionColor(value.color);
	if (!isValidColor) addIssue(`${path}.color`, 'Expected a supported faction color.');
	return isValidId && isValidName && isValidColor;
}

function validateNpcType(value: unknown, path: string, addIssue: IssueRecorder): value is NpcType {
	if (!isRecord(value)) {
		addIssue(path, 'Expected an NPC type object.');
		return false;
	}

	const isValidId = validateStableId(value.id, `${path}.id`, addIssue);
	const isValidName = validateString(value.name, `${path}.name`, addIssue);
	const isValidInitiativeStat =
		typeof value.initiativeStat === 'number' && Number.isFinite(value.initiativeStat);
	if (!isValidInitiativeStat) {
		addIssue(`${path}.initiativeStat`, 'Expected a finite number.');
	}
	return isValidId && isValidName && isValidInitiativeStat;
}

function validateInitiativeRollMode(
	value: unknown,
	path: string,
	addIssue: IssueRecorder
): value is InitiativeRollMode {
	if (value === 'app' || value === 'manual') return true;
	addIssue(path, 'Expected "app" or "manual".');
	return false;
}

function validateTurnInitiative(
	value: unknown,
	path: string,
	addIssue: IssueRecorder
): value is TurnInitiative {
	if (!isRecord(value)) {
		addIssue(path, 'Expected an initiative object.');
		return false;
	}

	switch (value.kind) {
		case 'roll':
			return validateInitiativeRollMode(value.mode, `${path}.mode`, addIssue);
		case 'static':
			if (typeof value.value === 'number' && Number.isFinite(value.value)) return true;
			addIssue(`${path}.value`, 'Expected a finite initiative value.');
			return false;
		case 'fixed-position': {
			let isValid = true;
			if (value.from !== 'top' && value.from !== 'bottom') {
				addIssue(`${path}.from`, 'Expected "top" or "bottom".');
				isValid = false;
			}
			if (typeof value.position !== 'number' || !Number.isFinite(value.position)) {
				addIssue(`${path}.position`, 'Expected a finite number.');
				isValid = false;
			}
			return isValid;
		}
		case 'relative-position': {
			let isValid = true;
			if (value.relation !== 'before' && value.relation !== 'after') {
				addIssue(`${path}.relation`, 'Expected "before" or "after".');
				isValid = false;
			}
			if (typeof value.distance !== 'number' || !Number.isFinite(value.distance)) {
				addIssue(`${path}.distance`, 'Expected a finite number.');
				isValid = false;
			}
			if (!validateStableId(value.targetTurnId, `${path}.targetTurnId`, addIssue)) {
				isValid = false;
			}
			return isValid;
		}
		default:
			addIssue(`${path}.kind`, 'Expected a supported initiative kind.');
			return false;
	}
}

function validateTurn(value: unknown, path: string, addIssue: IssueRecorder): value is Turn {
	if (!isRecord(value)) {
		addIssue(path, 'Expected a turn object.');
		return false;
	}

	const isValidId = validateStableId(value.id, `${path}.id`, addIssue);

	let isValidInitiative: boolean;
	if (!('initiative' in value)) {
		addIssue(`${path}.initiative`, 'Expected an initiative rule.');
		isValidInitiative = false;
	} else {
		isValidInitiative = validateTurnInitiative(value.initiative, `${path}.initiative`, addIssue);
	}

	return isValidId && isValidInitiative;
}

function validateTurns(value: unknown, path: string, addIssue: IssueRecorder): value is Turn[] {
	return validateArray(value, path, addIssue, validateTurn);
}

function validateCharacterCreature(
	value: UnknownRecord,
	path: string,
	addIssue: IssueRecorder
): value is UnknownRecord & CharacterCreature {
	const isValidId = validateStableId(value.id, `${path}.id`, addIssue);
	const isValidDetails = validateCharacterDetails(value, path, addIssue);
	const isValidFactionId = validateStableId(value.factionId, `${path}.factionId`, addIssue);
	const isValidHidden = typeof value.isHidden === 'boolean';
	if (!isValidHidden) addIssue(`${path}.isHidden`, 'Expected a boolean.');
	const isValidTurns = validateTurns(value.turns, `${path}.turns`, addIssue);
	return isValidId && isValidDetails && isValidFactionId && isValidHidden && isValidTurns;
}

function validateNpcCreature(
	value: UnknownRecord,
	path: string,
	addIssue: IssueRecorder
): value is UnknownRecord & NpcCreature {
	const isValidId = validateStableId(value.id, `${path}.id`, addIssue);
	const isValidTypeId = validateStableId(value.creatureTypeId, `${path}.creatureTypeId`, addIssue);
	const isValidIdentifier = validateString(value.identifier, `${path}.identifier`, addIssue);
	const isValidFactionId = validateStableId(value.factionId, `${path}.factionId`, addIssue);
	const isValidHidden = typeof value.isHidden === 'boolean';
	if (!isValidHidden) addIssue(`${path}.isHidden`, 'Expected a boolean.');
	const isValidTurns = validateTurns(value.turns, `${path}.turns`, addIssue);
	return (
		isValidId &&
		isValidTypeId &&
		isValidIdentifier &&
		isValidFactionId &&
		isValidHidden &&
		isValidTurns
	);
}

function validateCreature(
	value: unknown,
	path: string,
	addIssue: IssueRecorder
): value is ChallengeCreature {
	if (!isRecord(value)) {
		addIssue(path, 'Expected a creature object.');
		return false;
	}
	if (value.kind === 'character') return validateCharacterCreature(value, path, addIssue);
	if (value.kind === 'npc') return validateNpcCreature(value, path, addIssue);

	addIssue(`${path}.kind`, 'Expected "character" or "npc".');
	return false;
}

function validateRunState(
	value: unknown,
	path: string,
	addIssue: IssueRecorder
): value is ChallengeRunState {
	if (!isRecord(value)) {
		addIssue(path, 'Expected a run state object.');
		return false;
	}

	let isValidResults = true;
	if (!isRecord(value.initiativeResults)) {
		addIssue(`${path}.initiativeResults`, 'Expected an object keyed by turn UUID.');
		isValidResults = false;
	} else {
		for (const [id, initiative] of Object.entries(value.initiativeResults)) {
			if (parseUuid(id) === null) {
				addIssue(`${path}.initiativeResults.${id}`, 'Expected a valid turn UUID key.');
				isValidResults = false;
			}
			if (typeof initiative !== 'number' || !Number.isInteger(initiative) || initiative < 0) {
				addIssue(
					`${path}.initiativeResults.${id}`,
					'Expected a non-negative whole-number initiative value.'
				);
				isValidResults = false;
			}
		}
	}

	let isValidOrder = true;
	if ('generatedTurnOrder' in value) {
		isValidOrder = validateArray(
			value.generatedTurnOrder,
			`${path}.generatedTurnOrder`,
			addIssue,
			validateGeneratedTurnOrderEntry
		);
	}

	let isValidTieDecisions = true;
	if ('tieDecisions' in value && value.tieDecisions !== undefined) {
		const tieDecisions = value.tieDecisions;
		if (!Array.isArray(tieDecisions)) {
			addIssue(`${path}.tieDecisions`, 'Expected an array of turn UUID arrays.');
			isValidTieDecisions = false;
		} else {
			tieDecisions.forEach((decision: unknown, index) => {
				const decisionPath = `${path}.tieDecisions[${index}]`;
				if (!Array.isArray(decision) || decision.length < 2) {
					addIssue(decisionPath, 'Expected an array of at least two turn UUIDs.');
					isValidTieDecisions = false;
					return;
				}
				decision.forEach((id: unknown, idIndex) => {
					if (typeof id !== 'string' || parseUuid(id) === null) {
						addIssue(`${decisionPath}[${idIndex}]`, 'Expected a valid turn UUID.');
						isValidTieDecisions = false;
					}
				});
			});
		}
	}
	return isValidResults && isValidOrder && isValidTieDecisions;
}

function validateChallenge(
	value: unknown,
	path: string,
	addIssue: IssueRecorder
): value is Challenge {
	if (!isRecord(value)) {
		addIssue(path, 'Expected a challenge object.');
		return false;
	}

	const isValidId = validateStableId(value.id, `${path}.id`, addIssue);
	const isValidName = validateString(value.name, `${path}.name`, addIssue);
	const isValidCreatedAt = validateDate(value.createdAt, `${path}.createdAt`, addIssue);
	const isValidUpdatedAt = validateDate(value.updatedAt, `${path}.updatedAt`, addIssue);
	const isValidFactions = validateArray(
		value.factions,
		`${path}.factions`,
		addIssue,
		validateFaction
	);
	const isValidNpcTypes = validateArray(
		value.npcTypes,
		`${path}.npcTypes`,
		addIssue,
		validateNpcType
	);
	const isValidFairnessWeight =
		typeof value.fairnessWeight === 'number' && Number.isFinite(value.fairnessWeight);
	if (!isValidFairnessWeight) {
		addIssue(`${path}.fairnessWeight`, 'Expected a finite number.');
	}
	const isValidCreatures = validateArray(
		value.creatures,
		`${path}.creatures`,
		addIssue,
		validateCreature
	);
	let isValidRunState = true;
	if ('runState' in value && value.runState !== undefined) {
		isValidRunState = validateRunState(value.runState, `${path}.runState`, addIssue);
	}

	return (
		isValidId &&
		isValidName &&
		isValidCreatedAt &&
		isValidUpdatedAt &&
		isValidFactions &&
		isValidNpcTypes &&
		isValidFairnessWeight &&
		isValidCreatures &&
		isValidRunState
	);
}

function validateLibraryShape(value: unknown, addIssue: IssueRecorder): value is ChallengeLibrary {
	if (!isRecord(value)) {
		addIssue('$', 'Expected a challenge library object.');
		return false;
	}

	const isValidVersion = value.formatVersion === 1;
	if (!isValidVersion) addIssue('$.formatVersion', 'Unsupported challenge library version.');
	const isValidChallenges = validateArray(
		value.challenges,
		'$.challenges',
		addIssue,
		validateChallenge
	);
	return isValidVersion && isValidChallenges;
}

function getArray(value: unknown): readonly unknown[] {
	return Array.isArray(value) ? value : [];
}

function getEntityId(value: unknown): string | undefined {
	if (!isRecord(value) || typeof value.id !== 'string') return undefined;
	return parseUuid(value.id)?.toLowerCase();
}

function getEntityPaths(value: UnknownRecord): readonly { id: string; path: string }[] {
	return [
		...getArray(value.challenges).flatMap((challenge, challengeIndex) => {
			if (!isRecord(challenge)) return [];
			const path = `$.challenges[${challengeIndex}]`;
			return [
				...(getEntityId(challenge) ? [{ id: getEntityId(challenge)!, path: `${path}.id` }] : []),
				...getArray(challenge.factions).flatMap((faction, index) => {
					const id = getEntityId(faction);
					return id ? [{ id, path: `${path}.factions[${index}].id` }] : [];
				}),
				...getArray(challenge.npcTypes).flatMap((npcType, index) => {
					const id = getEntityId(npcType);
					return id ? [{ id, path: `${path}.npcTypes[${index}].id` }] : [];
				}),
				...getArray(challenge.creatures).flatMap((creature, creatureIndex) => {
					if (!isRecord(creature)) return [];
					const creaturePath = `${path}.creatures[${creatureIndex}]`;
					return [
						...(getEntityId(creature)
							? [{ id: getEntityId(creature)!, path: `${creaturePath}.id` }]
							: []),
						...getArray(creature.turns).flatMap((turn, turnIndex) => {
							const id = getEntityId(turn);
							return id ? [{ id, path: `${creaturePath}.turns[${turnIndex}].id` }] : [];
						})
					];
				})
			];
		})
	];
}

function validateUniqueIds(value: UnknownRecord, addIssue: IssueRecorder): void {
	const ids = getEntityPaths(value);
	ids.forEach(({ id, path }, index) => {
		if (ids.slice(0, index).some((previous) => previous.id === id)) {
			addIssue(path, 'Duplicate entity UUID.');
		}
	});
}

function getIds(value: unknown): ReadonlySet<string> {
	return new Set(
		getArray(value)
			.map(getEntityId)
			.filter((id): id is string => id !== undefined)
	);
}

function getTurnEntries(
	challenge: UnknownRecord,
	path: string
): readonly { readonly id: string; readonly turn: UnknownRecord; readonly path: string }[] {
	return getArray(challenge.creatures).flatMap((creature, creatureIndex) => {
		if (!isRecord(creature)) return [];
		const creaturePath = `${path}.creatures[${creatureIndex}]`;
		return getArray(creature.turns).flatMap((turn, turnIndex) => {
			const id = getEntityId(turn);
			return id && isRecord(turn)
				? [{ id, turn, path: `${creaturePath}.turns[${turnIndex}]` }]
				: [];
		});
	});
}

function validateChallengeReferences(
	challenge: UnknownRecord,
	path: string,
	addIssue: IssueRecorder
): void {
	const entityIds = (entities: readonly unknown[]): ReadonlySet<string> => getIds(entities);
	const factionIds = entityIds(getArray(challenge.factions));
	const npcTypeIds = entityIds(getArray(challenge.npcTypes));
	const turnEntries = getTurnEntries(challenge, path);

	getArray(challenge.creatures).forEach((creature, creatureIndex) => {
		if (!isRecord(creature)) return;
		const creaturePath = `${path}.creatures[${creatureIndex}]`;
		const factionId =
			typeof creature.factionId === 'string'
				? parseUuid(creature.factionId)?.toLowerCase()
				: undefined;
		if (factionId && !factionIds.has(factionId)) {
			addIssue(`${creaturePath}.factionId`, 'References a faction that does not exist.');
		}

		const creatureTypeId =
			typeof creature.creatureTypeId === 'string'
				? parseUuid(creature.creatureTypeId)?.toLowerCase()
				: undefined;
		if (creature.kind === 'npc' && creatureTypeId && !npcTypeIds.has(creatureTypeId)) {
			addIssue(`${creaturePath}.creatureTypeId`, 'References an NPC type that does not exist.');
		}
	});

	const turnIds = new Set(turnEntries.map(({ id }) => id));
	turnEntries.forEach(({ id, turn, path: turnPath }) => {
		if (!isRecord(turn.initiative) || turn.initiative.kind !== 'relative-position') return;
		const targetTurnId =
			typeof turn.initiative.targetTurnId === 'string'
				? parseUuid(turn.initiative.targetTurnId)?.toLowerCase()
				: undefined;
		if (targetTurnId && !turnIds.has(targetTurnId)) {
			addIssue(
				`${turnPath}.initiative.targetTurnId`,
				'References a turn that does not exist in this challenge.'
			);
		} else if (targetTurnId && targetTurnId === id) {
			addIssue(
				`${turnPath}.initiative.targetTurnId`,
				'A turn cannot be positioned relative to itself.'
			);
		}
	});

	if (!isRecord(challenge.runState)) return;
	validateRunStateReferences(challenge.runState, turnEntries, turnIds, path, addIssue);
}

function validateRunStateReferences(
	runState: UnknownRecord,
	turnEntries: readonly {
		readonly id: string;
		readonly turn: UnknownRecord;
		readonly path: string;
	}[],
	turnIds: ReadonlySet<string>,
	path: string,
	addIssue: IssueRecorder
): void {
	const initiativeResults = isRecord(runState.initiativeResults)
		? Object.keys(runState.initiativeResults)
		: [];
	initiativeResults.forEach((resultId) => {
		const id = parseUuid(resultId)?.toLowerCase();
		if (!id) return;
		const turn = turnEntries.find((entry) => entry.id === id);
		const resultPath = `${path}.runState.initiativeResults.${resultId}`;
		if (!turn) {
			addIssue(resultPath, 'References a turn that does not exist in this challenge.');
		} else if (!isRecord(turn.turn.initiative) || turn.turn.initiative.kind !== 'roll') {
			addIssue(resultPath, 'Initiative results can only be stored for turns configured to roll.');
		}
	});

	if (Array.isArray(runState.tieDecisions)) {
		runState.tieDecisions.forEach((decision: unknown, index) => {
			if (!Array.isArray(decision)) return;
			const seen = new Set<string>();
			decision.forEach((turnId: unknown, idIndex) => {
				const id = typeof turnId === 'string' ? parseUuid(turnId)?.toLowerCase() : undefined;
				if (!id) return;
				const decisionPath = `${path}.runState.tieDecisions[${index}][${idIndex}]`;
				if (!turnIds.has(id)) {
					addIssue(decisionPath, 'References a turn that does not exist in this challenge.');
				}
				if (seen.has(id)) addIssue(decisionPath, 'Turn appears more than once in the decision.');
				seen.add(id);
			});
		});
	}

	const generatedTurnOrder = runState.generatedTurnOrder;
	if (!Array.isArray(generatedTurnOrder)) return;
	const orderedIds = new Set<string>();
	let hasSpawn = false;
	generatedTurnOrder.forEach((item, index) => {
		const orderPath = `${path}.runState.generatedTurnOrder[${index}]`;
		if (isRecord(item) && item.kind === 'spawn') {
			if (hasSpawn) addIssue(orderPath, 'Spawn appears more than once in the order.');
			hasSpawn = true;
			return;
		}
		const id =
			isRecord(item) && typeof item.turnId === 'string'
				? parseUuid(item.turnId)?.toLowerCase()
				: undefined;
		if (!id) return;
		if (!turnIds.has(id)) {
			addIssue(orderPath, 'References a turn that does not exist in this challenge.');
		}
		if (orderedIds.has(id)) addIssue(orderPath, 'Turn appears more than once in the order.');
		orderedIds.add(id);
	});
}

/**
 * Validates untrusted runtime data as a challenge library, including entity IDs
 * and references between factions, NPC types, turns, and run state.
 * @param value Untrusted value to validate.
 * @returns A discriminated result containing either the validated library or all issues.
 */
export function validateChallengeLibrary(value: unknown): ValidationResult<ChallengeLibrary> {
	const { addIssue, getIssues } = createIssueFactory();
	const isValidShape = validateLibraryShape(value, addIssue);
	if (isRecord(value)) {
		validateUniqueIds(value, addIssue);
		getArray(value.challenges).forEach((challenge, index) => {
			if (isRecord(challenge)) {
				validateChallengeReferences(challenge, `$.challenges[${index}]`, addIssue);
			}
		});
	}

	const issues = getIssues();
	if (!isValidShape || issues.length > 0) return { isValid: false, issues };
	return { isValid: true, value };
}
