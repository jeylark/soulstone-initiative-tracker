import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeDiagnosticLog } from './diagnostic-logger';

let logDirectory: string;

afterEach(() => {
	if (logDirectory) rmSync(logDirectory, { ['recursive']: true, ['force']: true });
	logDirectory = '';
});

function readLogEntries(logPath: string): readonly Record<string, unknown>[] {
	return readFileSync(logPath, 'utf8')
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('writeDiagnosticLog', () => {
	it('writes structured entries as JSON lines and creates the log directory', () => {
		logDirectory = mkdtempSync(join(tmpdir(), 'soulstone-diagnostics-'));
		const logPath = join(logDirectory, 'nested', 'diagnostics.jsonl');

		writeDiagnosticLog(
			{
				severity: 'info',
				event: 'http.request.completed',
				source: '/api/sessions',
				correlationId: 'request-id',
				method: 'POST',
				status: 201,
				durationMs: 8
			},
			logPath
		);

		const entries = readLogEntries(logPath);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			severity: 'info',
			event: 'http.request.completed',
			source: '/api/sessions',
			correlationId: 'request-id',
			method: 'POST',
			status: 201,
			durationMs: 8
		});
		expect(Date.parse(String(entries[0]?.timestamp))).not.toBeNaN();
	});

	it('writes error stack frames without error messages or request secrets', () => {
		logDirectory = mkdtempSync(join(tmpdir(), 'soulstone-diagnostics-'));
		const logPath = join(logDirectory, 'diagnostics.jsonl');
		const error = new Error(
			'challenge contents; viewer code VIEWER-SECRET; reconnect token TOKEN-SECRET; authorization Bearer AUTH-SECRET'
		);

		writeDiagnosticLog(
			{
				severity: 'error',
				event: 'http.request.failed',
				source: '/api/sessions/[sessionId]',
				correlationId: 'request-id',
				error
			},
			logPath
		);

		const serialized = readFileSync(logPath, 'utf8');
		const [entry] = readLogEntries(logPath);
		expect(entry).toMatchObject({ errorType: 'Error' });
		expect(entry?.stackTrace).toEqual(
			expect.arrayContaining([expect.stringContaining('diagnostic-logger.spec.ts')])
		);
		expect(serialized).not.toContain('challenge contents');
		expect(serialized).not.toContain('VIEWER-SECRET');
		expect(serialized).not.toContain('TOKEN-SECRET');
		expect(serialized).not.toContain('AUTH-SECRET');
	});

	it('rotates log files and evicts the oldest entries to stay within the retained-size limit', () => {
		logDirectory = mkdtempSync(join(tmpdir(), 'soulstone-diagnostics-'));
		const logPath = join(logDirectory, 'diagnostics.jsonl');
		const maxRetainedLogSizeBytes = 600;

		for (let index = 1; index <= 6; index += 1) {
			writeDiagnosticLog(
				{
					severity: 'info',
					event: `event-${index}`,
					source: '/test',
					correlationId: `request-${index}`
				},
				logPath,
				maxRetainedLogSizeBytes
			);
		}

		const logFiles = readdirSync(logDirectory)
			.filter((fileName) => fileName.startsWith('diagnostics.jsonl'))
			.map((fileName) => join(logDirectory, fileName));
		const totalSize = logFiles.reduce((size, filePath) => size + statSync(filePath).size, 0);
		const retainedEvents = logFiles
			.flatMap((filePath) => readLogEntries(filePath).map((entry) => entry.event))
			.sort((left, right) => String(left).localeCompare(String(right)));

		expect(logFiles).toContain(logPath);
		expect(totalSize).toBeLessThanOrEqual(maxRetainedLogSizeBytes);
		expect(retainedEvents).toEqual(['event-3', 'event-4', 'event-5', 'event-6']);
	});

	it('rejects a record larger than the retained-size limit without writing it', () => {
		logDirectory = mkdtempSync(join(tmpdir(), 'soulstone-diagnostics-'));
		const logPath = join(logDirectory, 'diagnostics.jsonl');

		expect(() =>
			writeDiagnosticLog(
				{
					severity: 'info',
					event: 'too-large',
					source: '/test',
					correlationId: 'request-id'
				},
				logPath,
				1
			)
		).toThrow('The diagnostic log entry exceeds the retained log size limit.');
		expect(readdirSync(logDirectory)).toEqual([]);
	});
});
