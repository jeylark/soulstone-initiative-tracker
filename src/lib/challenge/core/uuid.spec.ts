import { describe, expect, it } from 'vitest';
import { createUuid, parseUuid } from './uuid';

describe('UUID helpers', () => {
	it('creates version 4 UUIDs', () => {
		expect(createUuid()).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
		);
	});

	it.each(['01234567-89ab-4cde-8abc-0123456789ab', '01234567-89AB-4CDE-8ABC-0123456789AB'])(
		'parses valid UUID %s without changing its casing',
		(value) => {
			expect(parseUuid(value)).toBe(value);
		}
	);

	it.each([
		'',
		'not-a-uuid',
		'01234567-89ab-9cde-8abc-0123456789ab',
		'01234567-89ab-4cde-7abc-0123456789ab',
		'01234567-89ab-4cde-8abc-0123456789a'
	])('rejects malformed UUID %s', (value) => {
		expect(parseUuid(value)).toBeNull();
	});
});
