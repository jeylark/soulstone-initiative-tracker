import type { Challenge, ChallengeLibrary, PlayerCharacter, StableId } from './model';
import { downloadChallengeJson, readChallengeJsonFile } from './json-files';
import { createUuid, parseUuid } from './uuid';
import { loadChallengeLibrary, saveChallengeLibrary } from './storage';

type DeepReadonly<T> = T extends readonly (infer U)[]
	? readonly DeepReadonly<U>[]
	: T extends object
		? { readonly [K in keyof T]: DeepReadonly<T[K]> }
		: T;

/** Explicit choice required when an imported challenge has an existing ID. */
export type ChallengeImportOptions =
	| Readonly<{ resolution: 'copy' }>
	| Readonly<{
			resolution: 'replace';
			activeChallengeIds: ReadonlySet<StableId>;
	  }>;

/** A conflict or invalid operation while importing a single challenge file. */
export class ChallengeImportError extends Error {
	readonly code: 'challenge-conflict' | 'active-challenge';
	readonly challengeId: StableId;

	constructor(code: ChallengeImportError['code'], challengeId: StableId, message: string) {
		super(message);
		this.name = 'ChallengeImportError';
		this.code = code;
		this.challengeId = challengeId;
	}
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
	const characters = existingCharacters.map(({ id, name }) => ({ id, name }));
	const idMap = new Map<string, StableId>();

	importedCharacters.forEach((character) => {
		const existingCharacter = existingCharacters.find(
			({ id }) => id.toLowerCase() === character.id.toLowerCase()
		);
		if (existingCharacter?.name === character.name) {
			idMap.set(character.id.toLowerCase(), existingCharacter.id);
			return;
		}

		const id = usedIds.has(character.id.toLowerCase()) ? createUniqueId(usedIds) : character.id;
		usedIds.add(id.toLowerCase());
		idMap.set(character.id.toLowerCase(), id);
		characters.push({ id, name: character.name });
	});

	return { characters, idMap };
}

function cloneChallenge(challenge: DeepReadonly<Challenge>): Challenge {
	return {
		id: challenge.id,
		name: challenge.name,
		factions: challenge.factions.map(({ id, name }) => ({ id, name })),
		npcTypes: challenge.npcTypes.map(({ id, name, initiativeStat }) => ({
			id,
			name,
			initiativeStat
		})),
		initiativeRollModes: { ...challenge.initiativeRollModes },
		creatures: challenge.creatures.map((creature) => ({
			...creature,
			turns: creature.turns.map((turn) => ({
				...turn,
				initiative: turn.initiative === null ? null : { ...turn.initiative }
			}))
		})),
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

	const factions = challenge.factions.map(({ id, name }) => ({
		id: mapId(id),
		name
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
								generatedTurnOrder: challenge.runState.generatedTurnOrder.map((id) => mapTurnId(id))
							})
				};

	return {
		challenge: {
			id: challengeId,
			name: challenge.name,
			factions,
			npcTypes,
			initiativeRollModes: { ...challenge.initiativeRollModes },
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
	).map(cloneChallenge);
	const retainedLibrary = { ...library, challenges: retainedChallenges };
	const usedIds = new Set(getLibraryEntityIds(retainedLibrary));
	const importedCharacters = importCharacters(
		library.characters,
		importedLibrary.characters,
		usedIds
	);
	const remapped = importChallengeEntities(importedChallenge, usedIds);
	const remappedChallenge = cloneChallenge(remapped.challenge);
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
			challenges: library.challenges.map(cloneChallenge)
		},
		importedCharacters: result.characters.filter(({ id }) => importedIds.has(id))
	};
}

/** Saves a challenge snapshot, including its current run state, as a JSON file. */
export function saveChallengeToJsonFile(
	library: DeepReadonly<ChallengeLibrary>,
	challengeId: StableId
): void {
	downloadChallengeJson(library, challengeId);
}

/** Loads one challenge into the local library so play can continue. */
export async function loadChallengeFromJsonFile(
	file: Readonly<File>,
	options?: ChallengeImportOptions,
	indexedDbFactory: Readonly<IDBFactory> = globalThis.indexedDB
): Promise<Challenge> {
	const importedLibrary = await readChallengeJsonFile(file);
	const existingLibrary = await loadChallengeLibrary(indexedDbFactory);
	const result = mergeImportedChallenge(existingLibrary, importedLibrary, options);
	await saveChallengeLibrary(result.library, indexedDbFactory);
	return result.challenge;
}

/** Loads the reusable characters from a challenge file into the local library. */
export async function loadCharactersFromChallengeJsonFile(
	file: Readonly<File>,
	indexedDbFactory: Readonly<IDBFactory> = globalThis.indexedDB
): Promise<readonly PlayerCharacter[]> {
	const importedLibrary = await readChallengeJsonFile(file);
	const existingLibrary = await loadChallengeLibrary(indexedDbFactory);
	const result = mergeImportedCharacters(existingLibrary, importedLibrary);
	await saveChallengeLibrary(result.library, indexedDbFactory);
	return result.importedCharacters;
}
