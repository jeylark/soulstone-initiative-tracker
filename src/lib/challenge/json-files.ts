import type {
	Challenge,
	ChallengeCreature,
	ChallengeLibrary,
	StableId,
	TurnInitiative
} from './model';
import { validateChallengeLibrary, type ValidationIssue } from './validation';

const JSON_FILE_MIME_TYPE = 'application/json';
const LIBRARY_FILE_NAME = 'soulstone-challenge-library.json';

type DeepReadonly<T> = T extends readonly (infer U)[]
	? readonly DeepReadonly<U>[]
	: T extends object
		? { readonly [K in keyof T]: DeepReadonly<T[K]> }
		: T;

/** Failure while reading, validating, or writing challenge and library JSON files. */
export class ChallengeJsonFileError extends Error {
	readonly code:
		| 'invalid-json'
		| 'invalid-library'
		| 'unsupported-version'
		| 'challenge-not-found'
		| 'invalid-challenge-file'
		| 'file-read-failed'
		| 'browser-unavailable'
		| 'download-failed';
	readonly issues: readonly ValidationIssue[];
	readonly cause: unknown;

	constructor(
		code: ChallengeJsonFileError['code'],
		message: string,
		issues: readonly ValidationIssue[] = [],
		cause: unknown = null
	) {
		super(message);
		this.name = 'ChallengeJsonFileError';
		this.code = code;
		this.issues = [...issues];
		this.cause = cause;
	}
}

export interface ChallengeFileReadResult {
	readonly content: DeepReadonly<ChallengeLibrary>;
	readonly unreadableFields: readonly ValidationIssue[];
	readonly isPartial: boolean;
}

function parseJson(json: string): unknown {
	try {
		return JSON.parse(json);
	} catch (cause) {
		throw new ChallengeJsonFileError(
			'invalid-json',
			'The selected file is not valid JSON.',
			[],
			cause
		);
	}
}

function getValidatedLibrary(value: unknown): ChallengeLibrary {
	const result = validateChallengeLibrary(value);
	if (result.isValid) return result.value;

	const hasFormatVersion = typeof value === 'object' && value !== null && 'formatVersion' in value;
	const isUnsupportedVersion =
		hasFormatVersion &&
		result.issues.some((issue) => issue.path === '$.formatVersion') &&
		value.formatVersion !== 1;
	throw new ChallengeJsonFileError(
		isUnsupportedVersion ? 'unsupported-version' : 'invalid-library',
		isUnsupportedVersion
			? 'This file uses an unsupported format version. Use a compatible app version to open it.'
			: 'The challenge library file contains invalid data.',
		result.issues
	);
}

function sanitizeInitiative(
	initiative: DeepReadonly<TurnInitiative> | null
): TurnInitiative | null {
	if (initiative === null) return null;

	switch (initiative.kind) {
		case 'roll':
			return { kind: 'roll' };
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

function sanitizeCreature(creature: DeepReadonly<ChallengeCreature>): ChallengeCreature {
	const turns = creature.turns.map((turn) => ({
		id: turn.id,
		isHidden: turn.isHidden,
		initiative: sanitizeInitiative(turn.initiative)
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

function sanitizeChallenge(challenge: DeepReadonly<Challenge>): Challenge {
	return {
		id: challenge.id,
		name: challenge.name,
		factions: challenge.factions.map(({ id, name }) => ({ id, name })),
		npcTypes: challenge.npcTypes.map(({ id, name, initiativeStat }) => ({
			id,
			name,
			initiativeStat
		})),
		initiativeRollModes: {
			characters: challenge.initiativeRollModes.characters,
			npcs: challenge.initiativeRollModes.npcs
		},
		creatures: challenge.creatures.map(sanitizeCreature),
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

function sanitizeLibrary(library: DeepReadonly<ChallengeLibrary>): ChallengeLibrary {
	return {
		formatVersion: library.formatVersion,
		characters: library.characters.map(({ id, name }) => ({ id, name })),
		challenges: library.challenges.map(sanitizeChallenge)
	};
}

function serializeLibrary(library: DeepReadonly<ChallengeLibrary>): string {
	try {
		return `${JSON.stringify(sanitizeLibrary(library), null, 2)}\n`;
	} catch (cause) {
		throw new ChallengeJsonFileError(
			'invalid-library',
			'Unable to serialize the challenge library as JSON.',
			[],
			cause
		);
	}
}

function parseLibrary(json: string): ChallengeLibrary {
	return sanitizeLibrary(getValidatedLibrary(parseJson(json)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rebaseValidationIssues(
	issues: readonly ValidationIssue[],
	from: string,
	to: string
): readonly ValidationIssue[] {
	return issues.map(({ path, message }) => ({
		path: path.replace(from, to),
		message
	}));
}

function getChallengeFileReadResult(value: unknown): ChallengeFileReadResult {
	if (!isRecord(value)) {
		throw new ChallengeJsonFileError('invalid-library', 'The challenge file is not an object.', [
			{ path: '$', message: 'Expected a challenge library object.' }
		]);
	}
	if (value.formatVersion !== 1) {
		throw new ChallengeJsonFileError(
			'unsupported-version',
			'This file uses an unsupported format version. Use a compatible app version to open it.',
			[{ path: '$.formatVersion', message: 'Unsupported challenge library version.' }]
		);
	}

	const issues: ValidationIssue[] = [];
	const characters: ChallengeLibrary['characters'] = [];
	const seenCharacterIds = new Set<string>();
	if (!Array.isArray(value.characters)) {
		issues.push({ path: '$.characters', message: 'Expected an array.' });
	} else {
		value.characters.forEach((character, index) => {
			const result = validateChallengeLibrary({
				formatVersion: 1,
				characters: [character],
				challenges: []
			});
			if (!result.isValid) {
				issues.push(
					...rebaseValidationIssues(result.issues, '$.characters[0]', `$.characters[${index}]`)
				);
				return;
			}

			const validCharacter = result.value.characters[0];
			if (!validCharacter) return;
			const normalizedId = validCharacter.id.toLowerCase();
			if (seenCharacterIds.has(normalizedId)) {
				issues.push({
					path: `$.characters[${index}].id`,
					message: 'Duplicate character UUID; this character was skipped.'
				});
				return;
			}
			seenCharacterIds.add(normalizedId);
			characters.push(validCharacter);
		});
	}

	let challenge: ChallengeLibrary['challenges'][number] | undefined;
	if (!Array.isArray(value.challenges)) {
		issues.push({ path: '$.challenges', message: 'Expected an array.' });
	} else if (value.challenges.length !== 1) {
		issues.push({
			path: '$.challenges',
			message: 'A challenge file must contain exactly one challenge; challenge data was skipped.'
		});
	} else {
		const result = validateChallengeLibrary({
			formatVersion: 1,
			characters,
			challenges: value.challenges
		});
		if (!result.isValid) {
			issues.push(...result.issues);
		} else {
			challenge = result.value.challenges[0];
		}
	}

	const content = sanitizeLibrary({
		formatVersion: 1,
		characters,
		challenges: challenge ? [challenge] : []
	});
	return {
		content,
		unreadableFields: issues,
		isPartial: issues.length > 0
	};
}

function downloadJsonFile(fileName: string, json: string): void {
	if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
		throw new ChallengeJsonFileError(
			'browser-unavailable',
			'Downloading JSON files is only available in a browser.'
		);
	}

	const blobUrl = URL.createObjectURL(new Blob([json], { type: JSON_FILE_MIME_TYPE }));
	const link = document.createElement('a');
	link.href = blobUrl;
	link.download = fileName;
	link.hidden = true;
	document.body.append(link);

	try {
		link.click();
	} catch (cause) {
		throw new ChallengeJsonFileError(
			'download-failed',
			'Unable to download the challenge JSON file.',
			[],
			cause
		);
	} finally {
		link.remove();
		URL.revokeObjectURL(blobUrl);
	}
}

function createChallengeFileLibrary(
	libraryValue: unknown,
	challengeId: StableId
): ChallengeLibrary {
	const library = getValidatedLibrary(libraryValue);
	const challenge = library.challenges.find((entry) => entry.id === challengeId);
	if (!challenge) {
		throw new ChallengeJsonFileError(
			'challenge-not-found',
			'The selected challenge does not exist in this library.'
		);
	}

	const characterIds = new Set(
		challenge.creatures.flatMap((creature) =>
			creature.kind === 'character' ? [creature.characterId] : []
		)
	);
	return {
		formatVersion: library.formatVersion,
		characters: library.characters.filter(({ id }) => characterIds.has(id)),
		challenges: [challenge]
	};
}

function createFileName(challengeName: string): string {
	const slug = challengeName
		.normalize('NFKD')
		.replace(/[^\w\s-]/g, '')
		.trim()
		.replace(/[\s_-]+/g, '-')
		.toLowerCase();
	return `${slug || 'challenge'}.json`;
}

async function readFile(file: Readonly<File>): Promise<string> {
	try {
		return await file.text();
	} catch (cause) {
		throw new ChallengeJsonFileError(
			'file-read-failed',
			'Unable to read the selected JSON file.',
			[],
			cause
		);
	}
}

/** Creates a readable, versioned JSON backup of the complete challenge library. */
export function createChallengeLibraryJson(value: unknown): string {
	return serializeLibrary(getValidatedLibrary(value));
}

/** Parses and validates a complete challenge library JSON backup. */
export function parseChallengeLibraryJson(json: string): ChallengeLibrary {
	return parseLibrary(json);
}

/** Downloads a readable JSON backup of the complete challenge library. */
export function downloadChallengeLibraryJson(value: unknown): void {
	downloadJsonFile(LIBRARY_FILE_NAME, createChallengeLibraryJson(value));
}

/** Creates a readable JSON file containing one challenge and its referenced characters. */
export function createChallengeJson(value: unknown, challengeId: StableId): string {
	const challengeFile = createChallengeFileLibrary(value, challengeId);
	return serializeLibrary(challengeFile);
}

/** Parses a JSON file containing exactly one challenge and its referenced characters. */
export function parseChallengeJson(json: string): ChallengeLibrary {
	const library = parseLibrary(json);
	if (library.challenges.length !== 1) {
		throw new ChallengeJsonFileError(
			'invalid-challenge-file',
			'A challenge file must contain exactly one challenge.'
		);
	}
	return library;
}

/** Downloads one challenge and the reusable characters it references as JSON. */
export function downloadChallengeJson(value: unknown, challengeId: StableId): void {
	const library = createChallengeFileLibrary(value, challengeId);
	const challenge = library.challenges[0];
	if (!challenge) {
		throw new ChallengeJsonFileError(
			'challenge-not-found',
			'The selected challenge does not exist in this library.'
		);
	}
	downloadJsonFile(createFileName(challenge.name), serializeLibrary(library));
}

/** Reads and validates a JSON backup from a browser-selected file. */
export async function readChallengeLibraryJsonFile(
	file: Readonly<File>
): Promise<ChallengeLibrary> {
	return parseLibrary(await readFile(file));
}

/** Reads a single-challenge file and reports content that could not be recovered. */
export async function readChallengeJsonFile(
	file: Readonly<File>
): Promise<ChallengeFileReadResult> {
	return getChallengeFileReadResult(parseJson(await readFile(file)));
}
