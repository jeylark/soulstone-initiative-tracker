import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const LOG_FILE_PATH = '/app/logs/diagnostics.jsonl';

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
 * @returns Nothing.
 * @throws {Error} If the log directory or file cannot be created or written.
 */
export function writeDiagnosticLog(
	entry: Readonly<DiagnosticLogEntry>,
	logFilePath: string = LOG_FILE_PATH
): void {
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

	mkdirSync(dirname(logFilePath), { ['recursive']: true, mode: 0o700 });
	appendFileSync(logFilePath, `${JSON.stringify(record)}\n`, {
		encoding: 'utf8',
		mode: 0o600
	});
}

function getStackTrace(error: unknown): readonly string[] {
	if (!(error instanceof Error) || typeof error.stack !== 'string') return [];
	return error.stack.split(/\r?\n/).filter((line) => /^\s+at\s/.test(line));
}
