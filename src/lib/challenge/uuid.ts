import type { UUID as Uuid } from 'node:crypto';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createUuid(): Uuid {
	return globalThis.crypto.randomUUID() as Uuid;
}

export function parseUuid(value: string): Uuid | null {
	return uuidPattern.test(value) ? (value as Uuid) : null;
}
