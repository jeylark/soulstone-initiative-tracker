import { readFileSync } from 'node:fs';

const SERVER_CONFIG_PATH = '/app/config/server.json';
const DEFAULT_MAX_ACTIVE_SESSIONS = 100;

/** Server settings loaded from the mounted JSON configuration file. */
export interface ServerConfig {
	/** Maximum number of live sessions held in memory at once. */
	readonly maxActiveSessions: number;
}

/**
 * Loads the server configuration, defaulting the active-session limit to 100.
 *
 * A missing file uses defaults; unreadable, malformed, or invalid configuration is an error.
 *
 * @param configPath Path to the JSON configuration file.
 * @returns Validated server settings.
 * @throws {Error} If the file cannot be read, parsed, or validated.
 */
export function loadServerConfig(configPath: string = SERVER_CONFIG_PATH): ServerConfig {
	let contents: string;
	try {
		contents = readFileSync(configPath, 'utf8');
	} catch (error) {
		if (isNodeError(error) && error.code === 'ENOENT') {
			return { maxActiveSessions: DEFAULT_MAX_ACTIVE_SESSIONS };
		}
		throw new Error('Unable to read the server configuration file.', { cause: error });
	}

	let value: unknown;
	try {
		value = JSON.parse(contents);
	} catch {
		throw new Error('The server configuration file is not valid JSON.');
	}

	if (!isRecord(value)) {
		throw new Error('The server configuration must be a JSON object.');
	}

	const maxActiveSessions =
		value.maxActiveSessions === undefined ? DEFAULT_MAX_ACTIVE_SESSIONS : value.maxActiveSessions;
	if (
		typeof maxActiveSessions !== 'number' ||
		!Number.isSafeInteger(maxActiveSessions) ||
		maxActiveSessions < 0
	) {
		throw new Error('maxActiveSessions must be a non-negative safe integer.');
	}

	return { maxActiveSessions };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && 'code' in error && typeof error.code === 'string';
}
