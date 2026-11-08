import { describe, expect, it } from 'vitest';
import { sanitizeChallengeLibraryData } from './raw-sanitizer';

describe('raw challenge-library sanitization', () => {
	it('removes unused properties recursively without interpreting legacy distance', () => {
		const date = new Date('2026-01-01');
		const value = {
			formatVersion: 1,
			unused: true,
			challenges: [
				{
					id: 'challenge',
					name: 'Saved',
					createdAt: date,
					updatedAt: date,
					fairnessWeight: -1,
					unused: true,
					factions: [{ id: 'faction', name: 'Players', color: 'blue', unused: true }],
					npcTypes: [{ id: 'type', name: 'Monster', initiativeStat: 3, unused: true }],
					creatures: [
						{
							id: 'creature',
							kind: 'character',
							name: 'Hero',
							factionId: 'faction',
							isHidden: false,
							unused: true,
							turns: [
								{
									id: 'turn',
									unused: true,
									initiative: {
										kind: 'relative-position',
										relation: 'after',
										targetTurnId: 'target',
										distance: 4
									}
								}
							]
						}
					],
					runState: {
						initiativeResults: { turn: 7 },
						tieDecisions: [['turn', 'other']],
						generatedTurnOrder: [
							{ kind: 'turn', turnId: 'turn', unused: true },
							{ kind: 'spawn', unused: true }
						],
						spawnCount: 2,
						unused: true
					}
				}
			]
		};
		const result = sanitizeChallengeLibraryData(value);
		expect(result).toEqual({
			formatVersion: 1,
			challenges: [
				{
					id: 'challenge',
					name: 'Saved',
					createdAt: date,
					updatedAt: date,
					fairnessWeight: -1,
					factions: [{ id: 'faction', name: 'Players', color: 'blue' }],
					npcTypes: [{ id: 'type', name: 'Monster', initiativeStat: 3 }],
					creatures: [
						{
							id: 'creature',
							kind: 'character',
							name: 'Hero',
							factionId: 'faction',
							isHidden: false,
							turns: [
								{
									id: 'turn',
									initiative: {
										kind: 'relative-position',
										relation: 'after',
										targetTurnId: 'target'
									}
								}
							]
						}
					],
					runState: {
						initiativeResults: { turn: 7 },
						tieDecisions: [['turn', 'other']],
						generatedTurnOrder: [{ kind: 'turn', turnId: 'turn' }, { kind: 'spawn' }],
						spawnCount: 2
					}
				}
			]
		});
		expect(value.challenges[0].creatures[0].turns[0].initiative.distance).toBe(4);
		expect(sanitizeChallengeLibraryData(result)).toEqual(result);
	});

	it('preserves malformed known fields, unknown kinds and dynamic result keys for validation', () => {
		const value = {
			formatVersion: 9,
			challenges: [
				{
					name: 42,
					creatures: [{ kind: 'unknown', turns: null }],
					runState: { initiativeResults: { invalid: -2 } }
				}
			]
		};
		expect(sanitizeChallengeLibraryData(value)).toEqual(value);
		expect(sanitizeChallengeLibraryData(null)).toBeNull();
	});
});
