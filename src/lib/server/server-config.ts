import { readFileSync } from 'node:fs';

const SERVER_CONFIG_PATH = '/app/config/server.json';
const DEFAULT_MAX_ACTIVE_SESSIONS = 100;
const DEFAULT_MAX_VIEWER_CONNECTIONS_PER_SESSION = 100;
const DEFAULT_SESSION_INACTIVITY_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const DEFAULT_MAX_RETAINED_LOG_SIZE_BYTES = 1_000_000_000;

/** Server settings loaded from the mounted JSON configuration file. */
export interface ServerConfig {
	/** Maximum number of live sessions held in memory at once. */
	readonly maxActiveSessions: number;
	/** Maximum number of concurrent viewer connections for one live session. */
	readonly maxViewerConnectionsPerSession: number;
	/** Time without DM activity before a live session expires, in milliseconds. */
	readonly sessionInactivityTimeoutMs: number;
	/** Maximum combined size of retained log files, in bytes. */
	readonly maxRetainedLogSizeBytes: number;
}

/**
 * Loads server configuration from a JSON file and applies defaults for omitted values.
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
			return {
				maxActiveSessions: DEFAULT_MAX_ACTIVE_SESSIONS,
				maxViewerConnectionsPerSession: DEFAULT_MAX_VIEWER_CONNECTIONS_PER_SESSION,
				sessionInactivityTimeoutMs: DEFAULT_SESSION_INACTIVITY_TIMEOUT_MS,
				maxRetainedLogSizeBytes: DEFAULT_MAX_RETAINED_LOG_SIZE_BYTES
			};
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

	return {
		maxActiveSessions: readLimit(
			value.maxActiveSessions,
			'maxActiveSessions',
			DEFAULT_MAX_ACTIVE_SESSIONS
		),
		maxViewerConnectionsPerSession: readLimit(
			value.maxViewerConnectionsPerSession,
			'maxViewerConnectionsPerSession',
			DEFAULT_MAX_VIEWER_CONNECTIONS_PER_SESSION
		),
		sessionInactivityTimeoutMs: readLimit(
			value.sessionInactivityTimeoutMs,
			'sessionInactivityTimeoutMs',
			DEFAULT_SESSION_INACTIVITY_TIMEOUT_MS
		),
		maxRetainedLogSizeBytes: readLimit(
			value.maxRetainedLogSizeBytes,
			'maxRetainedLogSizeBytes',
			DEFAULT_MAX_RETAINED_LOG_SIZE_BYTES
		)
	};
}

function readLimit(value: unknown, name: string, defaultValue: number): number {
	const limit = value === undefined ? defaultValue : value;
	if (typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit < 0) {
		throw new Error(`${name} must be a non-negative safe integer.`);
	}
	return limit;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && 'code' in error && typeof error.code === 'string';
}
