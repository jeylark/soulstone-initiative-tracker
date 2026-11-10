import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { loadServerConfig } from './server-config';

const LOG_FILE_PATH = '/app/logs/diagnostics.jsonl';
const MAX_ARCHIVED_LOG_FILES = 4;
const DEFAULT_MAX_RETAINED_LOG_SIZE_BYTES = loadServerConfig().maxRetainedLogSizeBytes;

/** A safe, structured diagnostic event written to the server log. */
export interface DiagnosticLogEntry {
	/** Severity of this event. */
	readonly severity: 'info' | 'warn' | 'error';
	/** Stable event name that describes what happened. */
	readonly event: string;
	/** Source route or subsystem associated with the event. */
	readonly source: string;
	/** Identifier shared by log records for one request. */
	readonly correlationId: string;
	/** HTTP method, when this event describes a request. */
	readonly method?: string;
	/** HTTP response status, when this event describes a completed request. */
	readonly status?: number;
	/** Request processing time in milliseconds. */
	readonly durationMs?: number;
	/** Error to record by type and stack frames, without its message. */
	readonly error?: unknown;
}

/**
 * Appends a safe diagnostic event as one JSON line.
 *
 * Request bodies, URLs, headers, and error messages are not written. Filesystem
 * failures are allowed to propagate so diagnostic loss is not silent.
 *
 * @param entry Structured diagnostic details to write.
 * @param logFilePath Destination file; defaults to the mounted log directory.
 * @param maxRetainedLogSizeBytes Maximum combined size of the active log and its archives; must be a non-negative safe integer.
 * @returns Nothing.
 * @throws {Error} If the limit is invalid, an entry exceeds it, or the log cannot be written.
 */
export function writeDiagnosticLog(
	entry: Readonly<DiagnosticLogEntry>,
	logFilePath: string = LOG_FILE_PATH,
	maxRetainedLogSizeBytes: number = DEFAULT_MAX_RETAINED_LOG_SIZE_BYTES
): void {
	if (!Number.isSafeInteger(maxRetainedLogSizeBytes) || maxRetainedLogSizeBytes < 0) {
		throw new RangeError('The maximum retained log size must be a non-negative safe integer.');
	}

	const errorDetails =
		entry.error === undefined
			? {}
			: {
					errorType:
						entry.error instanceof Error ? entry.error.constructor.name : typeof entry.error,
					stackTrace: getStackTrace(entry.error)
				};
	const record = {
		timestamp: new Date().toISOString(),
		severity: entry.severity,
		event: entry.event,
		source: entry.source,
		correlationId: entry.correlationId,
		...(entry.method === undefined ? {} : { method: entry.method }),
		...(entry.status === undefined ? {} : { status: entry.status }),
		...(entry.durationMs === undefined ? {} : { durationMs: entry.durationMs }),
		...errorDetails
	};
	const line = `${JSON.stringify(record)}\n`;
	const lineSize = Buffer.byteLength(line, 'utf8');
	if (lineSize > maxRetainedLogSizeBytes) {
		throw new Error('The diagnostic log entry exceeds the retained log size limit.');
	}

	mkdirSync(dirname(logFilePath), { ['recursive']: true, mode: 0o700 });
	rotateLogIfNeeded(logFilePath, lineSize, maxRetainedLogSizeBytes);
	pruneArchivedLogs(logFilePath, lineSize, maxRetainedLogSizeBytes);
	appendFileSync(logFilePath, line, {
		encoding: 'utf8',
		mode: 0o600
	});
}

function rotateLogIfNeeded(
	logFilePath: string,
	nextLineSize: number,
	maxRetainedLogSizeBytes: number
): void {
	const activeLogSize = existsSync(logFilePath) ? statSync(logFilePath).size : 0;
	const targetFileSize = Math.max(
		1,
		Math.ceil(maxRetainedLogSizeBytes / (MAX_ARCHIVED_LOG_FILES + 1))
	);
	if (activeLogSize === 0 || activeLogSize + nextLineSize <= targetFileSize) return;

	for (let archiveIndex = MAX_ARCHIVED_LOG_FILES; archiveIndex >= 1; archiveIndex -= 1) {
		const archivePath = getArchivePath(logFilePath, archiveIndex);
		if (archiveIndex === MAX_ARCHIVED_LOG_FILES && existsSync(archivePath)) {
			unlinkSync(archivePath);
		}

		const sourcePath =
			archiveIndex === 1 ? logFilePath : getArchivePath(logFilePath, archiveIndex - 1);
		if (existsSync(sourcePath)) renameSync(sourcePath, archivePath);
	}
}

function pruneArchivedLogs(
	logFilePath: string,
	nextLineSize: number,
	maxRetainedLogSizeBytes: number
): void {
	let totalSize = getRetainedLogPaths(logFilePath).reduce(
		(size, path) => size + statSync(path).size,
		0
	);

	for (
		let archiveIndex = MAX_ARCHIVED_LOG_FILES;
		totalSize + nextLineSize > maxRetainedLogSizeBytes && archiveIndex >= 1;
		archiveIndex -= 1
	) {
		const archivePath = getArchivePath(logFilePath, archiveIndex);
		if (!existsSync(archivePath)) continue;
		totalSize -= statSync(archivePath).size;
		unlinkSync(archivePath);
	}
}

function getRetainedLogPaths(logFilePath: string): readonly string[] {
	const paths = [logFilePath];
	for (let archiveIndex = 1; archiveIndex <= MAX_ARCHIVED_LOG_FILES; archiveIndex += 1) {
		paths.push(getArchivePath(logFilePath, archiveIndex));
	}
	return paths.filter((path) => existsSync(path));
}

function getArchivePath(logFilePath: string, archiveIndex: number): string {
	return join(dirname(logFilePath), `${basename(logFilePath)}.${archiveIndex}`);
}

function getStackTrace(error: unknown): readonly string[] {
	if (!(error instanceof Error) || typeof error.stack !== 'string') return [];
	return error.stack.split(/\r?\n/).filter((line) => /^\s+at\s/.test(line));
}
