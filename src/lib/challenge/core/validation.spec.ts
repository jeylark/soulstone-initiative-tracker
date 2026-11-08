import { describe, expect, it } from 'vitest';
import { CHALLENGE_FORMAT_VERSION, type ChallengeLibrary, type StableId } from './model';
import { createUuid } from './uuid';
import { validateChallengeLibrary } from './validation';

const ids = {
	challenge: createUuid(),
	faction: createUuid(),
	npcType: createUuid(),
	creature: createUuid(),
	turn: createUuid()
} satisfies Record<string, StableId>;

const library = {
	formatVersion: CHALLENGE_FORMAT_VERSION,
	challenges: [
		{
			id: ids.challenge,
			name: 'The Old Keep',
			createdAt: new Date('2025-01-02T03:04:05.000Z'),
			updatedAt: new Date('2025-01-02T03:04:05.000Z'),
			factions: [{ id: ids.faction, name: 'Adventurers', color: 'blue' }],
			npcTypes: [{ id: ids.npcType, name: 'Skeleton', initiativeStat: 2 }],
			fairnessWeight: 3,
			creatures: [
				{
					id: ids.creature,
					kind: 'character',
					name: 'Aria',
					factionId: ids.faction,
					isHidden: false,
					turns: [{ id: ids.turn, initiative: { kind: 'roll', mode: 'manual' } }]
				}
			],
			runState: { initiativeResults: { [ids.turn]: 12 } }
		}
	]
} satisfies ChallengeLibrary;

describe('challenge library validation', () => {
	it('returns the original library when it is valid', () => {
		const result = validateChallengeLibrary(library);

		expect(result.isValid).toBe(true);
		if (result.isValid) expect(result.value).toBe(library);
	});

	it('reports structural issues at their data paths', () => {
		const invalidLibrary = {
			...library,
			challenges: library.challenges.map((challenge) => ({
				...challenge,
				factions: challenge.factions.map((faction) => ({ ...faction, color: 'ultraviolet' }))
			}))
		};
		const result = validateChallengeLibrary(invalidLibrary);

		expect(result.isValid).toBe(false);
		if (!result.isValid) {
			expect(result.issues).toContainEqual({
				path: '$.challenges[0].factions[0].color',
				message: 'Expected a supported faction color.'
			});
		}
	});

	it('reports broken references at their data paths', () => {
		const invalidLibrary = {
			...library,
			challenges: library.challenges.map((challenge) => ({
				...challenge,
				creatures: challenge.creatures.map((creature) => ({
					...creature,
					factionId: createUuid()
				}))
			}))
		};
		const result = validateChallengeLibrary(invalidLibrary);

		expect(result.isValid).toBe(false);
		if (!result.isValid) {
			expect(result.issues).toContainEqual({
				path: '$.challenges[0].creatures[0].factionId',
				message: 'References a faction that does not exist.'
			});
		}
	});

	it('rejects duplicate IDs across entity types', () => {
		const invalidLibrary = {
			...library,
			challenges: library.challenges.map((challenge) => ({
				...challenge,
				npcTypes: challenge.npcTypes.map((npcType) => ({ ...npcType, id: ids.faction }))
			}))
		};
		const result = validateChallengeLibrary(invalidLibrary);

		expect(result.isValid).toBe(false);
		if (!result.isValid) {
			expect(result.issues).toContainEqual({
				path: '$.challenges[0].npcTypes[0].id',
				message: 'Duplicate entity UUID.'
			});
		}
	});
});
