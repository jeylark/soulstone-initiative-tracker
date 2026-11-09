import { describe, expect, it } from 'vitest';
import { sanitizeChallengeLibraryData } from './raw-sanitizer';

describe('raw challenge-library sanitization', () => {
	it('removes unused properties recursively without interpreting legacy distance', () => {
		const date = new Date('2026-01-01');
		const value = {
			formatVersion: 1,
			unused: 'legacy',
			challenges: [
				{
					id: 'challenge',
					name: 'Saved',
					createdAt: date,
					updatedAt: date,
					fairnessWeight: -1,
					unused: 'legacy',
					factions: [{ id: 'faction', name: 'Players', color: 'blue', unused: 'legacy' }],
					npcTypes: [{ id: 'type', name: 'Monster', initiativeStat: 3, unused: 'legacy' }],
					creatures: [
						{
							id: 'creature',
							kind: 'character',
							name: 'Hero',
							factionId: 'faction',
							isHidden: false,
							unused: 'legacy',
							turns: [
								{
									id: 'turn',
									unused: 'legacy',
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
							{ kind: 'turn', turnId: 'turn', unused: 'legacy' },
							{ kind: 'spawn', unused: 'legacy' }
						],
						spawnCount: 2,
						spawnEdit: {
							newCreatureIds: ['creature'],
							newNpcTypeIds: ['type'],
							newTurnIds: ['turn'],
							lockedInitiativeTurnIds: ['other'],
							unused: 'legacy'
						},
						unused: 'legacy'
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
						spawnCount: 2,
						spawnEdit: {
							newCreatureIds: ['creature'],
							newNpcTypeIds: ['type'],
							newTurnIds: ['turn'],
							lockedInitiativeTurnIds: ['other']
						}
					}
				}
			]
		});
		expect(value.challenges[0].creatures[0].turns[0].initiative.distance).toBe(4);
		expect(sanitizeChallengeLibraryData(result)).toEqual(result);
	});

	it('keeps only the fields belonging to recognized initiative and creature variants', () => {
		const initiatives = [
			{ kind: 'roll', mode: 'app' },
			{ kind: 'static', value: 12 },
			{ kind: 'fixed-position', from: 'bottom', position: 2 },
			{ kind: 'relative-position', relation: 'before', targetTurnId: 'target', index: 1 }
		];
		const creature = {
			id: 'npc',
			kind: 'npc',
			creatureTypeId: 'type',
			identifier: '1',
			factionId: 'faction',
			isHidden: true,
			turns: initiatives.map((initiative, index) => ({ id: String(index), initiative }))
		};
		const expected = { formatVersion: 1, challenges: [{ creatures: [creature] }] };
		const value = {
			formatVersion: 1,
			challenges: [
				{
					creatures: [
						{
							...creature,
							name: 'unused character field',
							initiativeStat: 4,
							turns: creature.turns.map((turn) => ({
								...turn,
								initiative: { unused: 'legacy', ...turn.initiative }
							}))
						}
					]
				}
			]
		};
		expect(sanitizeChallengeLibraryData(value)).toEqual(expected);
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
