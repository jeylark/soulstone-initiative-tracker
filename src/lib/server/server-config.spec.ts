import { existsSync, mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadServerConfig } from './server-config';

let configDirectory: string;
let configPath: string;

afterEach(() => {
	if (!configDirectory) return;
	if (existsSync(configPath)) unlinkSync(configPath);
	rmdirSync(configDirectory);
	configDirectory = '';
	configPath = '';
});

function createConfigFile(content: string): string {
	configDirectory = mkdtempSync(join(tmpdir(), 'soulstone-server-config-'));
	configPath = join(configDirectory, 'server.json');
	writeFileSync(configPath, content);
	return configPath;
}

describe('loadServerConfig', () => {
	it('uses default limits when the configuration file is absent', () => {
		configDirectory = mkdtempSync(join(tmpdir(), 'soulstone-server-config-'));
		configPath = join(configDirectory, 'server.json');

		expect(loadServerConfig(configPath)).toEqual({
			maxActiveSessions: 100,
			maxViewerConnectionsPerSession: 100,
			sessionInactivityTimeoutMs: 21_600_000,
			maxRetainedLogSizeBytes: 1_000_000_000
		});
	});

	it('loads configured limits', () => {
		const configPath = createConfigFile(
			JSON.stringify({
				maxActiveSessions: 12,
				maxViewerConnectionsPerSession: 8,
				sessionInactivityTimeoutMs: 60_000,
				maxRetainedLogSizeBytes: 500_000
			})
		);

		expect(loadServerConfig(configPath)).toEqual({
			maxActiveSessions: 12,
			maxViewerConnectionsPerSession: 8,
			sessionInactivityTimeoutMs: 60_000,
			maxRetainedLogSizeBytes: 500_000
		});
	});

	it('uses defaults for omitted limits', () => {
		const configPath = createConfigFile('{}');

		expect(loadServerConfig(configPath)).toEqual({
			maxActiveSessions: 100,
			maxViewerConnectionsPerSession: 100,
			sessionInactivityTimeoutMs: 21_600_000,
			maxRetainedLogSizeBytes: 1_000_000_000
		});
	});

	it('rejects malformed configuration JSON', () => {
		const configPath = createConfigFile('{');

		expect(() => loadServerConfig(configPath)).toThrow(
			'The server configuration file is not valid JSON.'
		);
	});

	it.each([
		['maxActiveSessions', null],
		['maxActiveSessions', -1],
		['maxActiveSessions', 1.5],
		['maxActiveSessions', Number.MAX_SAFE_INTEGER + 1],
		['maxActiveSessions', '12'],
		['maxViewerConnectionsPerSession', null],
		['maxViewerConnectionsPerSession', -1],
		['maxViewerConnectionsPerSession', 1.5],
		['maxViewerConnectionsPerSession', Number.MAX_SAFE_INTEGER + 1],
		['maxViewerConnectionsPerSession', '12'],
		['sessionInactivityTimeoutMs', null],
		['sessionInactivityTimeoutMs', -1],
		['sessionInactivityTimeoutMs', 1.5],
		['sessionInactivityTimeoutMs', Number.MAX_SAFE_INTEGER + 1],
		['sessionInactivityTimeoutMs', '12'],
		['maxRetainedLogSizeBytes', null],
		['maxRetainedLogSizeBytes', -1],
		['maxRetainedLogSizeBytes', 1.5],
		['maxRetainedLogSizeBytes', Number.MAX_SAFE_INTEGER + 1],
		['maxRetainedLogSizeBytes', '12']
	])('rejects invalid %s value: %s', (setting, value) => {
		const configPath = createConfigFile(JSON.stringify({ [setting]: value }));

		expect(() => loadServerConfig(configPath)).toThrow(
			`${setting} must be a non-negative safe integer.`
		);
	});
});
