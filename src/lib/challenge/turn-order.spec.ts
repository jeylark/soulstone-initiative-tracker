import { describe, expect, it } from 'vitest';
import type {
	Challenge,
	ChallengeCreature,
	InitiativeResults,
	StableId,
	Turn,
	TurnInitiative
} from './model';
import { createUuid } from './uuid';
import { generateTurnOrder } from './turn-order';

function createTurn(initiative: TurnInitiative | null): Turn {
	return { id: createUuid(), isHidden: false, initiative };
}

function createCreature(factionId: StableId, turns: readonly Turn[]): ChallengeCreature {
	return {
		id: createUuid(),
		kind: 'npc',
		creatureTypeId: createUuid(),
		identifier: 'A',
		factionId,
		turns: [...turns]
	};
}

function createChallenge(creatures: readonly ChallengeCreature[] = []): Challenge {
	return {
		id: createUuid(),
		name: 'Turn order test',
		createdAt: new Date(),
		updatedAt: new Date(),
		factions: [],
		npcTypes: [],
		initiativeRollModes: { characters: 'manual', npcs: 'app' },
		creatures: [...creatures]
	};
}

function rolledTurn(): Turn {
	return createTurn({ kind: 'roll' });
}

function staticTurn(value: number): Turn {
	return createTurn({ kind: 'static', value });
}

function order(
	creatures: readonly ChallengeCreature[],
	results: Readonly<InitiativeResults> = {},
	fairnessWeight = 0
): StableId[] {
	return generateTurnOrder(createChallenge(creatures), results, fairnessWeight);
}

describe('generateTurnOrder', () => {
	it('returns an empty order when the challenge has no creatures or turns', () => {
		expect(order([])).toEqual([]);
		expect(order([createCreature(createUuid(), [])])).toEqual([]);
	});

	it('omits turns without an initiative and rolled turns without a result', () => {
		const factionId = createUuid();
		const noInitiative = createTurn(null);
		const missingResult = rolledTurn();
		const staticInitiative = staticTurn(4);

		expect(
			order([createCreature(factionId, [noInitiative, missingResult, staticInitiative])])
		).toEqual([staticInitiative.id]);
	});

	it('sorts rolling and static initiatives from highest to lowest', () => {
		const factionId = createUuid();
		const highRoll = rolledTurn();
		const lowRoll = rolledTurn();
		const staticInitiative = staticTurn(7);
		const results = { [highRoll.id]: 12, [lowRoll.id]: 3 };

		expect(
			order([createCreature(factionId, [lowRoll, staticInitiative, highRoll])], results)
		).toEqual([highRoll.id, staticInitiative.id, lowRoll.id]);
	});

	it('includes zero and negative initiative values in descending order', () => {
		const factionId = createUuid();
		const negative = staticTurn(-2);
		const zero = staticTurn(0);
		const positive = staticTurn(1);

		expect(order([createCreature(factionId, [negative, positive, zero])])).toEqual([
			positive.id,
			zero.id,
			negative.id
		]);
	});

	it('uses higher initiative first across factions when fairness weight is zero', () => {
		const factionA = createUuid();
		const factionB = createUuid();
		const turnA = staticTurn(10);
		const turnB = staticTurn(8);
		const turnC = staticTurn(9);

		expect(
			order([createCreature(factionA, [turnA, turnB]), createCreature(factionB, [turnC])])
		).toEqual([turnA.id, turnC.id, turnB.id]);
	});

	it('balances factions using the configured fairness weight', () => {
		const factionA = createUuid();
		const factionB = createUuid();
		const a1 = staticTurn(10);
		const a2 = staticTurn(9);
		const a3 = staticTurn(8);
		const b1 = staticTurn(7);

		expect(
			order(
				[
					createCreature(factionA, [a1, a2]),
					createCreature(factionA, [a3]),
					createCreature(factionB, [b1])
				],
				{},
				10
			)
		).toEqual([a1.id, b1.id, a2.id, a3.id]);
	});

	it('keeps all tied initiative turns exactly once without prescribing their tie order', () => {
		const factionId = createUuid();
		const first = staticTurn(5);
		const second = staticTurn(5);
		const third = staticTurn(3);
		const result = order([createCreature(factionId, [first, second, third])]);

		expect(result).toHaveLength(3);
		expect(result).toEqual(expect.arrayContaining([first.id, second.id, third.id]));
	});

	it('places fixed turns at one-based positions from the top and bottom', () => {
		const factionId = createUuid();
		const first = staticTurn(9);
		const second = staticTurn(8);
		const third = staticTurn(7);
		const atTop = createTurn({ kind: 'fixed-position', from: 'top', position: 1 });
		const atBottom = createTurn({ kind: 'fixed-position', from: 'bottom', position: 1 });

		expect(order([createCreature(factionId, [first, second, third, atTop, atBottom])])).toEqual([
			atTop.id,
			first.id,
			second.id,
			third.id,
			atBottom.id
		]);
	});

	it('clamps fixed positions beyond the list to the nearest available position', () => {
		const factionId = createUuid();
		const first = staticTurn(9);
		const second = staticTurn(8);
		const tooHigh = createTurn({ kind: 'fixed-position', from: 'top', position: 99 });
		const tooLow = createTurn({ kind: 'fixed-position', from: 'bottom', position: 99 });

		expect(order([createCreature(factionId, [first, second, tooHigh, tooLow])])).toEqual([
			tooLow.id,
			first.id,
			second.id,
			tooHigh.id
		]);
	});

	it('places relative turns before and after their target at distance zero', () => {
		const factionId = createUuid();
		const before = createTurn({
			kind: 'relative-position',
			relation: 'before',
			distance: 0,
			targetTurnId: createUuid()
		});
		const target = staticTurn(7);
		const after = createTurn({
			kind: 'relative-position',
			relation: 'after',
			distance: 0,
			targetTurnId: target.id
		});
		const beforeTarget = {
			...before,
			initiative: {
				kind: 'relative-position',
				relation: 'before',
				distance: 0,
				targetTurnId: target.id
			}
		} satisfies Turn;

		expect(order([createCreature(factionId, [beforeTarget, target, after])])).toEqual([
			beforeTarget.id,
			target.id,
			after.id
		]);
	});

	it('leaves the configured number of turns between a relative turn and its target', () => {
		const factionId = createUuid();
		const leading = staticTurn(10);
		const target = staticTurn(8);
		const trailing = staticTurn(6);
		const oneBefore = createTurn({
			kind: 'relative-position',
			relation: 'before',
			distance: 1,
			targetTurnId: target.id
		});
		const oneAfter = createTurn({
			kind: 'relative-position',
			relation: 'after',
			distance: 1,
			targetTurnId: target.id
		});

		expect(
			order([createCreature(factionId, [leading, target, trailing, oneBefore, oneAfter])])
		).toEqual([leading.id, oneBefore.id, target.id, trailing.id, oneAfter.id]);
	});

	it('resolves a relative turn whose target is another hooked turn', () => {
		const factionId = createUuid();
		const target = staticTurn(5);
		const middle = createTurn({
			kind: 'relative-position',
			relation: 'after',
			distance: 0,
			targetTurnId: target.id
		});
		const last = createTurn({
			kind: 'relative-position',
			relation: 'after',
			distance: 0,
			targetTurnId: middle.id
		});

		expect(order([createCreature(factionId, [last, target, middle])])).toEqual([
			target.id,
			middle.id,
			last.id
		]);
	});

	it('rejects cyclic relative placements and reports all unresolved turn IDs', () => {
		const factionId = createUuid();
		const first = createTurn({
			kind: 'relative-position',
			relation: 'after',
			distance: 0,
			targetTurnId: createUuid()
		});
		const second = createTurn({
			kind: 'relative-position',
			relation: 'after',
			distance: 0,
			targetTurnId: first.id
		});
		const firstWithCycle = {
			...first,
			initiative: {
				kind: 'relative-position',
				relation: 'after',
				distance: 0,
				targetTurnId: second.id
			}
		} satisfies Turn;

		expect(() => order([createCreature(factionId, [firstWithCycle, second])])).toThrow(
			expect.objectContaining({
				name: 'TurnOrderError',
				turnIds: [first.id, second.id]
			})
		);
	});

	it('rejects a relative placement whose target is not in the challenge order', () => {
		const factionId = createUuid();
		const unresolved = createTurn({
			kind: 'relative-position',
			relation: 'before',
			distance: 0,
			targetTurnId: createUuid()
		});

		expect(() => order([createCreature(factionId, [unresolved])])).toThrow(
			expect.objectContaining({ name: 'TurnOrderError', turnIds: [unresolved.id] })
		);
	});
});
