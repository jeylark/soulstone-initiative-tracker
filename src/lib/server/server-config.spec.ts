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
	it('uses the default active-session limit when the configuration file is absent', () => {
		configDirectory = mkdtempSync(join(tmpdir(), 'soulstone-server-config-'));
		configPath = join(configDirectory, 'server.json');

		expect(loadServerConfig(configPath)).toEqual({ maxActiveSessions: 100 });
	});

	it('loads the configured active-session limit', () => {
		const configPath = createConfigFile(JSON.stringify({ maxActiveSessions: 12 }));

		expect(loadServerConfig(configPath)).toEqual({ maxActiveSessions: 12 });
	});

	it('uses the default when the active-session limit is omitted', () => {
		const configPath = createConfigFile('{}');

		expect(loadServerConfig(configPath)).toEqual({ maxActiveSessions: 100 });
	});

	it('rejects malformed configuration JSON', () => {
		const configPath = createConfigFile('{');

		expect(() => loadServerConfig(configPath)).toThrow(
			'The server configuration file is not valid JSON.'
		);
	});

	it.each([null, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '12'])(
		'rejects an invalid active-session limit: %s',
		(maxActiveSessions) => {
			const configPath = createConfigFile(JSON.stringify({ maxActiveSessions }));

			expect(() => loadServerConfig(configPath)).toThrow(
				'maxActiveSessions must be a non-negative safe integer.'
			);
		}
	);
});
