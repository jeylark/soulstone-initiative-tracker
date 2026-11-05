import { describe, expect, it } from 'vitest';
import type { Challenge, ChallengeCreature, PlayerCharacter, Turn } from './model';
import { createUuid } from './uuid';
import { createTurnDisplayLookup } from './turn-display';

function createTurn(initiative: Readonly<Turn['initiative']>): Turn {
	return { id: createUuid(), initiative };
}

function createChallenge(creatures: readonly ChallengeCreature[] = []): Challenge {
	const createdAt = new Date('2026-01-01T00:00:00.000Z');
	return {
		id: createUuid(),
		name: 'Turn display test',
		createdAt,
		updatedAt: createdAt,
		factions: [{ id: createUuid(), name: 'Players', color: 'blue' }],
		npcTypes: [{ id: createUuid(), name: 'Sentinel', initiativeStat: 2 }],
		fairnessWeight: 3,
		creatures: [...creatures]
	};
}

describe('createTurnDisplayLookup', () => {
	it('resolves every turn with its creature, faction, full-list label, and hidden state', () => {
		const characterId = createUuid();
		const faction = { id: createUuid(), name: 'Players', color: 'blue' } as const;
		const npcFaction = { id: createUuid(), name: 'Enemies', color: 'red' } as const;
		const characterFirstTurn = createTurn({ kind: 'static', value: 8 });
		const characterSecondTurn = createTurn({ kind: 'fixed-position', from: 'top', position: 1 });
		const npcTurn = createTurn({ kind: 'roll', mode: 'manual' });
		const character: ChallengeCreature = {
			id: createUuid(),
			kind: 'character',
			characterId,
			factionId: faction.id,
			isHidden: true,
			turns: [characterFirstTurn, characterSecondTurn]
		};
		const npcTypeId = createUuid();
		const npc: ChallengeCreature = {
			id: createUuid(),
			kind: 'npc',
			creatureTypeId: npcTypeId,
			identifier: 'B',
			factionId: npcFaction.id,
			isHidden: false,
			turns: [npcTurn]
		};
		const challenge = createChallenge([character, npc]);
		challenge.factions = [faction, npcFaction];
		challenge.npcTypes[0].id = npcTypeId;
		const characters: PlayerCharacter[] = [{ id: characterId, name: 'Aria' }];

		const lookup = createTurnDisplayLookup(challenge, characters);

		expect(lookup.size).toBe(3);
		expect(lookup.get(characterFirstTurn.id)).toEqual({
			creature: character,
			faction,
			label: 'Aria - Turn 1',
			isHidden: true
		});
		expect(lookup.get(characterSecondTurn.id)?.label).toBe('Aria - Turn 2');
		expect(lookup.get(npcTurn.id)).toEqual({
			creature: npc,
			faction: npcFaction,
			label: 'Sentinel B',
			isHidden: false
		});
	});

	it('uses the existing fallback names for missing character and NPC definitions', () => {
		const characterTurn = createTurn({ kind: 'roll', mode: 'manual' });
		const npcTurn = createTurn({ kind: 'static', value: 4 });
		const character: ChallengeCreature = {
			id: createUuid(),
			kind: 'character',
			characterId: createUuid(),
			factionId: createUuid(),
			isHidden: false,
			turns: [characterTurn]
		};
		const npc: ChallengeCreature = {
			id: createUuid(),
			kind: 'npc',
			creatureTypeId: createUuid(),
			identifier: 'C',
			factionId: createUuid(),
			isHidden: true,
			turns: [npcTurn]
		};
		const lookup = createTurnDisplayLookup(createChallenge([character, npc]), []);

		expect(lookup.get(characterTurn.id)?.label).toBe('Character');
		expect(lookup.get(npcTurn.id)?.label).toBe('NPC C');
		expect(lookup.get(characterTurn.id)?.faction).toBeUndefined();
		expect(lookup.get(npcTurn.id)?.isHidden).toBe(true);
	});
});
