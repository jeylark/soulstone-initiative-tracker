import type { ChallengeLibrary, StableId } from './model';
import { sanitizeChallenge, type DeepReadonly } from './challenge-copy';
import { validateChallengeLibrary, type ValidationIssue } from './validation';

const JSON_FILE_MIME_TYPE = 'application/json';
const LIBRARY_FILE_NAME = 'soulstone-challenge-library.json';

/** Failure while reading, validating, or writing challenge and library JSON files. */
export class ChallengeJsonFileError extends Error {
	/** Machine-readable category describing the file-operation failure. */
	readonly code:
		| 'invalid-json'
		| 'invalid-library'
		| 'unsupported-version'
		| 'challenge-not-found'
		| 'invalid-challenge-file'
		| 'file-read-failed'
		| 'browser-unavailable'
		| 'download-failed';
	/** Validation issues associated with invalid or partially readable data. */
	readonly issues: readonly ValidationIssue[];
	/** Underlying parse, read, serialization, or download failure when available. */
	readonly cause: unknown;

	/**
	 * @param code Machine-readable category describing the failure.
	 * @param message Human-readable explanation of the failure.
	 * @param issues Validation details associated with the failure.
	 * @param cause Underlying error when one caused the failure.
	 */
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
	/** Valid content recovered from the challenge file. */
	readonly content: DeepReadonly<ChallengeLibrary>;
	/** Paths and reasons for fields or sections that could not be read. */
	readonly unreadableFields: readonly ValidationIssue[];
	/** Whether any portion of the file was skipped or could not be recovered. */
	readonly isPartial: boolean;
}

function parseJson(json: string): unknown {
	try {
		return JSON.parse(json, (key: string, value: unknown) => {
			if ((key === 'createdAt' || key === 'updatedAt') && typeof value === 'string') {
				const date = new Date(value);
				if (Number.isFinite(date.getTime()) && date.toISOString() === value) return date;
			}
			return value;
		});
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

/**
 * Creates a readable, versioned JSON backup of the complete challenge library.
 * @param value Candidate library data to validate and serialize.
 * @returns Pretty-printed JSON containing only modeled library fields.
 * @throws {ChallengeJsonFileError} If the value is invalid or cannot be serialized.
 */
export function createChallengeLibraryJson(value: unknown): string {
	return serializeLibrary(getValidatedLibrary(value));
}

/**
 * Parses and validates a complete challenge-library backup.
 * @param json JSON text to parse.
 * @returns The validated challenge library.
 * @throws {ChallengeJsonFileError} If the JSON is malformed, invalid, or uses an unsupported version.
 */
export function parseChallengeLibraryJson(json: string): ChallengeLibrary {
	return parseLibrary(json);
}

/**
 * Downloads a readable JSON backup of the complete challenge library.
 * @param value Candidate library data to validate and download.
 * @throws {ChallengeJsonFileError} If the value is invalid or the browser cannot download the file.
 */
export function downloadChallengeLibraryJson(value: unknown): void {
	downloadJsonFile(LIBRARY_FILE_NAME, createChallengeLibraryJson(value));
}

/**
 * Creates a readable JSON file containing one challenge and its referenced characters.
 * @param value Candidate library containing the challenge and reusable characters.
 * @param challengeId Stable ID of the challenge to include.
 * @returns Pretty-printed JSON in the versioned library format.
 * @throws {ChallengeJsonFileError} If the library is invalid or the challenge does not exist.
 */
export function createChallengeJson(value: unknown, challengeId: StableId): string {
	const challengeFile = createChallengeFileLibrary(value, challengeId);
	return serializeLibrary(challengeFile);
}

/**
 * Parses a JSON document containing exactly one challenge and its referenced characters.
 * @param json JSON text to parse.
 * @returns The validated single-challenge library.
 * @throws {ChallengeJsonFileError} If the JSON or library is invalid, the version is unsupported,
 * or the document does not contain exactly one challenge.
 */
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

/**
 * Downloads one challenge and the reusable characters it references as JSON.
 * @param value Candidate library containing the challenge and reusable characters.
 * @param challengeId Stable ID of the challenge to download.
 * @throws {ChallengeJsonFileError} If the library is invalid, the challenge is missing, or download fails.
 */
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

/**
 * Reads and validates a complete library backup from a browser-selected file.
 * @param file User-selected JSON backup file.
 * @returns The validated challenge library.
 * @throws {ChallengeJsonFileError} If the file cannot be read, is invalid, or uses an unsupported version.
 */
export async function readChallengeLibraryJsonFile(
	file: Readonly<File>
): Promise<ChallengeLibrary> {
	return parseLibrary(await readFile(file));
}

/**
 * Reads a single-challenge file and reports any content that could not be recovered.
 * Malformed JSON and unsupported versions are rejected; invalid independent characters are skipped,
 * and challenge data is retained only when its complete structure and references validate.
 * @param file User-selected single-challenge JSON file.
 * @returns Recovered content, unreadable-field details, and whether the read was partial.
 * @throws {ChallengeJsonFileError} If the file cannot be read, is malformed JSON, or uses an unsupported version.
 */
export async function readChallengeJsonFile(
	file: Readonly<File>
): Promise<ChallengeFileReadResult> {
	return getChallengeFileReadResult(parseJson(await readFile(file)));
}
