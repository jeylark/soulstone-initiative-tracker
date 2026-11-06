import type { Challenge, ChallengeLibrary, PlayerCharacter, StableId } from './model';
import { sanitizeChallenge } from './challenge-copy';
import { type DeepReadonly } from '../DeepReadonly';
import { downloadChallengeJson, type ChallengeFileReadResult } from './json-files';
import type { ValidationIssue } from './validation';
import { createUuid, parseUuid } from './uuid';

/**
 * Resolution required when a challenge file contains unreadable fields.
 * `import-valid` accepts the recovered content; `abort` rejects the import.
 */
export type PartialImportResolution = 'import-valid' | 'abort';

/** Choices for handling unreadable sections and duplicate challenge IDs. */
export type ChallengeImportOptions = Readonly<{
	/** Required for partial files: import recovered content or abort. */
	partialImport?: PartialImportResolution;
}> &
	(
		| Readonly<{
				/** Leave unset when there is no ID conflict; conflicts require `copy` or `replace`. */
				resolution?: undefined;
		  }>
		| Readonly<{
				/** Keep the existing challenge and import this challenge as a copy with fresh IDs. */
				resolution: 'copy';
		  }>
		| Readonly<{
				/** Replace the existing inactive challenge with the imported challenge. */
				resolution: 'replace';
				/** Challenge IDs currently used by active sessions; these cannot be replaced. */
				activeChallengeIds: ReadonlySet<StableId>;
		  }>
	);

/** A prepared library update and the imported or copied challenge. */
export interface PreparedChallengeImport {
	/** Complete library to persist after the caller confirms the import. */
	readonly library: ChallengeLibrary;
	/** Imported challenge, with IDs adjusted if a copy was requested. */
	readonly challenge: Challenge;
}

/** A prepared library update and the reusable characters included in it. */
export interface PreparedCharacterImport {
	/** Complete library to persist after the caller confirms the import. */
	readonly library: ChallengeLibrary;
	/** Characters added or reused from the imported challenge file. */
	readonly importedCharacters: readonly PlayerCharacter[];
}

/** A conflict or invalid operation while importing a single challenge file. */
export class ChallengeImportError extends Error {
	/** `challenge-conflict` requires a copy/replace choice; `active-challenge` prevents replacement. */
	readonly code: 'challenge-conflict' | 'active-challenge';
	/** Stable ID of the challenge involved in the conflict. */
	readonly challengeId: StableId;

	/**
	 * @param code Conflict category.
	 * @param challengeId Stable ID of the challenge involved.
	 * @param message Human-readable explanation of the conflict.
	 */
	constructor(code: ChallengeImportError['code'], challengeId: StableId, message: string) {
		super(message);
		this.name = 'ChallengeImportError';
		this.code = code;
		this.challengeId = challengeId;
	}
}

/** The caller must choose whether to import valid sections or abort. */
export class PartialChallengeImportError extends Error {
	/**
	 * Machine-readable reason the partial import could not proceed:
	 * `partial-import-required` requests a choice; `partial-import-aborted` records cancellation;
	 * `no-importable-data` means no valid content remains for the requested operation.
	 */
	readonly code: 'partial-import-required' | 'partial-import-aborted' | 'no-importable-data';
	/** Validation issues that caused or informed the partial-import decision. */
	readonly issues: readonly ValidationIssue[];

	/**
	 * @param code Reason the partial import could not proceed.
	 * @param issues Validation details associated with the partial file.
	 * @param message Human-readable explanation of the partial-import result.
	 */
	constructor(
		code: PartialChallengeImportError['code'],
		issues: readonly ValidationIssue[],
		message: string
	) {
		super(message);
		this.name = 'PartialChallengeImportError';
		this.code = code;
		this.issues = [...issues];
	}
}

function resolvePartialImport(
	readResult: DeepReadonly<ChallengeFileReadResult>,
	resolution?: PartialImportResolution
): DeepReadonly<ChallengeLibrary> {
	if (resolution === 'abort') {
		throw new PartialChallengeImportError(
			'partial-import-aborted',
			readResult.unreadableFields,
			'Import was aborted because the file contains invalid sections.'
		);
	}
	if (readResult.isPartial && resolution !== 'import-valid') {
		throw new PartialChallengeImportError(
			'partial-import-required',
			readResult.unreadableFields,
			'The file contains invalid sections. Choose whether to import only valid data or abort.'
		);
	}
	return readResult.content;
}

function getLibraryEntityIds(library: DeepReadonly<ChallengeLibrary>): ReadonlySet<string> {
	const ids = new Set<string>();
	library.characters.forEach(({ id }) => ids.add(id.toLowerCase()));
	library.challenges.forEach((challenge) => {
		ids.add(challenge.id.toLowerCase());
		challenge.factions.forEach(({ id }) => ids.add(id.toLowerCase()));
		challenge.npcTypes.forEach(({ id }) => ids.add(id.toLowerCase()));
		challenge.creatures.forEach((creature) => {
			ids.add(creature.id.toLowerCase());
			creature.turns.forEach(({ id }) => ids.add(id.toLowerCase()));
		});
	});
	return ids;
}

function createUniqueId(usedIds: Set<string>): StableId {
	let id = createUuid();
	while (usedIds.has(id.toLowerCase())) id = createUuid();
	usedIds.add(id.toLowerCase());
	return id;
}

function importCharacters(
	existingCharacters: readonly DeepReadonly<PlayerCharacter>[],
	importedCharacters: readonly DeepReadonly<PlayerCharacter>[],
	usedIds: Set<string>
): Readonly<{
	characters: readonly PlayerCharacter[];
	idMap: ReadonlyMap<string, StableId>;
}> {
	const characters = existingCharacters.map(({ id, name, initiativeStat }) => ({
		id,
		name,
		...(initiativeStat === undefined ? {} : { initiativeStat })
	}));
	const idMap = new Map<string, StableId>();

	importedCharacters.forEach((character) => {
		const existingCharacter = existingCharacters.find(
			({ id }) => id.toLowerCase() === character.id.toLowerCase()
		);
		if (
			existingCharacter?.name === character.name &&
			existingCharacter?.initiativeStat === character.initiativeStat
		) {
			idMap.set(character.id.toLowerCase(), existingCharacter.id);
			return;
		}

		const id = usedIds.has(character.id.toLowerCase()) ? createUniqueId(usedIds) : character.id;
		usedIds.add(id.toLowerCase());
		idMap.set(character.id.toLowerCase(), id);
		characters.push({
			id,
			name: character.name,
			...(character.initiativeStat === undefined
				? {}
				: { initiativeStat: character.initiativeStat })
		});
	});

	return { characters, idMap };
}

function importChallengeEntities(
	challenge: DeepReadonly<Challenge>,
	usedIds: Set<string>
): Readonly<{
	challenge: Challenge;
}> {
	const entityIdMap = new Map<string, StableId>();
	const turnIdMap = new Map<string, StableId>();
	const mapId = (id: StableId): StableId => {
		const normalizedId = id.toLowerCase();
		const existing = entityIdMap.get(normalizedId);
		if (existing) return existing;
		const mappedId = usedIds.has(normalizedId) ? createUniqueId(usedIds) : id;
		usedIds.add(mappedId.toLowerCase());
		entityIdMap.set(normalizedId, mappedId);
		return mappedId;
	};
	const mapTurnId = (id: string): StableId => {
		const mappedId = turnIdMap.get(id.toLowerCase());
		if (mappedId) return mappedId;
		const parsedId = parseUuid(id);
		if (!parsedId) throw new Error('Validated turn reference is not a UUID.');
		return parsedId;
	};

	const challengeId = mapId(challenge.id);
	challenge.factions.forEach(({ id }) => mapId(id));
	challenge.npcTypes.forEach(({ id }) => mapId(id));
	challenge.creatures.forEach((creature) => {
		mapId(creature.id);
		creature.turns.forEach(({ id }) => {
			turnIdMap.set(id.toLowerCase(), mapId(id));
		});
	});

	const factions = challenge.factions.map(({ id, name, color }) => ({
		id: mapId(id),
		name,
		color
	}));
	const npcTypes = challenge.npcTypes.map(({ id, name, initiativeStat }) => ({
		id: mapId(id),
		name,
		initiativeStat
	}));
	const creatures = challenge.creatures.map((creature) => {
		const factionId = entityIdMap.get(creature.factionId.toLowerCase()) ?? creature.factionId;
		const turns = creature.turns.map((turn) => {
			const initiative =
				turn.initiative?.kind === 'relative-position'
					? {
							...turn.initiative,
							targetTurnId: mapTurnId(turn.initiative.targetTurnId)
						}
					: turn.initiative;
			return { ...turn, id: mapId(turn.id), initiative };
		});
		const creatureId = mapId(creature.id);
		if (creature.kind === 'character') return { ...creature, id: creatureId, factionId, turns };
		return {
			...creature,
			id: creatureId,
			factionId,
			creatureTypeId:
				entityIdMap.get(creature.creatureTypeId.toLowerCase()) ?? creature.creatureTypeId,
			turns
		};
	});

	const runState =
		challenge.runState === undefined
			? undefined
			: {
					initiativeResults: Object.fromEntries(
						Object.entries(challenge.runState.initiativeResults).map(([id, value]) => [
							mapTurnId(id),
							value
						])
					),
					...(challenge.runState.generatedTurnOrder === undefined
						? {}
						: {
								generatedTurnOrder: challenge.runState.generatedTurnOrder.map((entry) =>
									entry.kind === 'turn'
										? { kind: 'turn' as const, turnId: mapTurnId(entry.turnId) }
										: { kind: 'spawn' as const }
								)
							})
				};

	return {
		challenge: {
			id: challengeId,
			name: challenge.name,
			createdAt: new Date(challenge.createdAt.getTime()),
			updatedAt: new Date(challenge.updatedAt.getTime()),
			factions,
			npcTypes,
			fairnessWeight: challenge.fairnessWeight,
			creatures,
			...(runState === undefined ? {} : { runState })
		}
	};
}

function mergeImportedChallenge(
	library: DeepReadonly<ChallengeLibrary>,
	importedLibrary: DeepReadonly<ChallengeLibrary>,
	options?: ChallengeImportOptions
): Readonly<{ library: ChallengeLibrary; challenge: Challenge }> {
	const importedChallenge = importedLibrary.challenges[0];
	if (!importedChallenge) {
		throw new Error('A validated challenge file must contain one challenge.');
	}

	const existingChallenge = library.challenges.find(
		({ id }) => id.toLowerCase() === importedChallenge.id.toLowerCase()
	);
	if (existingChallenge && !options) {
		throw new ChallengeImportError(
			'challenge-conflict',
			importedChallenge.id,
			'A challenge with this ID already exists. Choose whether to replace it or import a copy.'
		);
	}
	if (
		existingChallenge &&
		options?.resolution === 'replace' &&
		[...options.activeChallengeIds].some(
			(id) => id.toLowerCase() === existingChallenge.id.toLowerCase()
		)
	) {
		throw new ChallengeImportError(
			'active-challenge',
			existingChallenge.id,
			'An active challenge cannot be replaced. Import a copy or end the active session first.'
		);
	}

	const isReplacing = existingChallenge !== undefined && options?.resolution === 'replace';
	const retainedChallenges = (
		isReplacing
			? library.challenges.filter(
					({ id }) => id.toLowerCase() !== existingChallenge.id.toLowerCase()
				)
			: library.challenges
	).map(sanitizeChallenge);
	const retainedLibrary = { ...library, challenges: retainedChallenges };
	const usedIds = new Set(getLibraryEntityIds(retainedLibrary));
	const importedCharacters = importCharacters(
		library.characters,
		importedLibrary.characters,
		usedIds
	);
	const remapped = importChallengeEntities(importedChallenge, usedIds);
	const sanitizedChallenge = sanitizeChallenge(remapped.challenge);
	const copyTimestamp = options?.resolution === 'copy' ? new Date() : undefined;
	const remappedChallenge =
		copyTimestamp === undefined
			? sanitizedChallenge
			: {
					...sanitizedChallenge,
					createdAt: new Date(copyTimestamp.getTime()),
					updatedAt: new Date(copyTimestamp.getTime())
				};
	const challenge: Challenge = {
		...remappedChallenge,
		creatures: remappedChallenge.creatures.map((creature) =>
			creature.kind === 'character'
				? {
						...creature,
						characterId:
							importedCharacters.idMap.get(creature.characterId.toLowerCase()) ??
							creature.characterId
					}
				: creature
		)
	};
	const nextLibrary: ChallengeLibrary = {
		formatVersion: library.formatVersion,
		characters: [...importedCharacters.characters],
		challenges: [...retainedChallenges, challenge]
	};

	return { library: nextLibrary, challenge };
}

function mergeImportedCharacters(
	library: DeepReadonly<ChallengeLibrary>,
	importedLibrary: DeepReadonly<ChallengeLibrary>
): Readonly<{ library: ChallengeLibrary; importedCharacters: readonly PlayerCharacter[] }> {
	const usedIds = new Set(getLibraryEntityIds(library));
	const result = importCharacters(library.characters, importedLibrary.characters, usedIds);
	const importedIds = new Set(result.idMap.values());
	return {
		library: {
			formatVersion: library.formatVersion,
			characters: [...result.characters],
			challenges: library.challenges.map(sanitizeChallenge)
		},
		importedCharacters: result.characters.filter(({ id }) => importedIds.has(id))
	};
}

/**
 * Saves a challenge snapshot, including its current run state, as a JSON file.
 * @param library Library containing the challenge to export.
 * @param challengeId Stable ID of the challenge to save.
 * @returns No value; starts the browser download.
 * @throws If the challenge is missing, the library is invalid, or the browser download fails.
 */
export function saveChallengeToJsonFile(
	library: DeepReadonly<ChallengeLibrary>,
	challengeId: StableId
): void {
	downloadChallengeJson(library, challengeId);
}

/**
 * Prepares one challenge for the current library without persisting it.
 * @param library Current library to merge the challenge into.
 * @param readResult Result returned by `readChallengeJsonFile`.
 * @param options Partial-file and duplicate-challenge resolution choices.
 * @returns Candidate library and imported challenge; the caller must persist the library separately.
 * @throws {PartialChallengeImportError} If partial content is not accepted or no valid challenge remains.
 * @throws {ChallengeImportError} If an existing challenge needs a resolution or cannot be replaced.
 */
export function prepareChallengeImport(
	library: DeepReadonly<ChallengeLibrary>,
	readResult: DeepReadonly<ChallengeFileReadResult>,
	options?: ChallengeImportOptions
): PreparedChallengeImport {
	const importedLibrary = resolvePartialImport(readResult, options?.partialImport);
	if (importedLibrary.challenges.length !== 1) {
		throw new PartialChallengeImportError(
			'no-importable-data',
			readResult.unreadableFields,
			'The file does not contain a valid challenge to import.'
		);
	}
	return mergeImportedChallenge(library, importedLibrary, options);
}

/**
 * Prepares reusable characters from a challenge file without persisting them.
 * @param library Current library to merge the characters into.
 * @param readResult Result returned by `readChallengeJsonFile`.
 * @param partialImport Choice required when the file was only partially readable.
 * @returns Candidate library and imported/reused characters; persist the library separately.
 * @throws {PartialChallengeImportError} If partial content is not accepted or no valid characters remain.
 */
export function prepareCharacterImport(
	library: DeepReadonly<ChallengeLibrary>,
	readResult: DeepReadonly<ChallengeFileReadResult>,
	partialImport?: PartialImportResolution
): PreparedCharacterImport {
	const importedLibrary = resolvePartialImport(readResult, partialImport);
	if (importedLibrary.characters.length === 0) {
		throw new PartialChallengeImportError(
			'no-importable-data',
			readResult.unreadableFields,
			'The file does not contain any valid reusable characters to import.'
		);
	}
	return mergeImportedCharacters(library, importedLibrary);
}
