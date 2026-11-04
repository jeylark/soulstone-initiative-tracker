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
import type { DeepReadonly } from '../DeepReadonly';

function createTurn(initiative: Readonly<TurnInitiative>): Turn {
	return { id: createUuid(), isHidden: false, initiative };
}

function createCreature(
	factionId: StableId,
	turns: readonly DeepReadonly<Turn>[]
): ChallengeCreature {
	return {
		id: createUuid(),
		kind: 'npc',
		creatureTypeId: createUuid(),
		identifier: 'A',
		factionId,
		turns: [...turns]
	};
}

function createChallenge(
	creatures: readonly DeepReadonly<ChallengeCreature>[] = [],
	fairnessWeight = 0
): DeepReadonly<Challenge> {
	return {
		id: createUuid(),
		name: 'Turn order test',
		createdAt: new Date(),
		updatedAt: new Date(),
		factions: [],
		npcTypes: [],
		fairnessWeight,
		creatures: [...creatures]
	};
}

function rolledTurn(): Turn {
	return createTurn({ kind: 'roll', mode: 'app' });
}

function staticTurn(value: number): Turn {
	return createTurn({ kind: 'static', value });
}

function order(
	creatures: readonly DeepReadonly<ChallengeCreature>[],
	results: Readonly<InitiativeResults> = {},
	fairnessWeight = 0
): StableId[] {
	return generateTurnOrder(createChallenge(creatures, fairnessWeight), results);
}

describe('generateTurnOrder', () => {
	it('returns an empty order when the challenge has no creatures or turns', () => {
		expect(order([])).toEqual([]);
		expect(order([createCreature(createUuid(), [])])).toEqual([]);
	});

	it('omits rolling turns without a result', () => {
		const factionId = createUuid();
		const missingResult = rolledTurn();
		const staticInitiative = staticTurn(4);

		expect(order([createCreature(factionId, [missingResult, staticInitiative])])).toEqual([
			staticInitiative.id
		]);
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

	it('orders tied turns of one faction by creature and turn setup order', () => {
		const factionId = createUuid();
		const first = staticTurn(5);
		const second = staticTurn(5);
		const third = staticTurn(3);
		const fourth = staticTurn(5);

		expect(
			order([
				createCreature(factionId, [first, second, third]),
				createCreature(factionId, [fourth])
			])
		).toEqual([first.id, second.id, fourth.id, third.id]);
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
		).toEqual([oneBefore.id, leading.id, target.id, trailing.id, oneAfter.id]);
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

	it('keeps hidden turns in the generated order', () => {
		const factionId = createUuid();
		const visible = staticTurn(5);
		const hidden = { ...staticTurn(8), isHidden: true };

		expect(order([createCreature(factionId, [visible, hidden])])).toEqual([hidden.id, visible.id]);
	});

	it('merges more than two factions by value when fairness weight is zero', () => {
		const a1 = staticTurn(9);
		const a2 = staticTurn(3);
		const b1 = staticTurn(7);
		const c1 = staticTurn(8);
		const c2 = staticTurn(1);

		expect(
			order([
				createCreature(createUuid(), [a1, a2]),
				createCreature(createUuid(), [b1]),
				createCreature(createUuid(), [c1, c2])
			])
		).toEqual([a1.id, c1.id, b1.id, a2.id, c2.id]);
	});

	it('collects the turns of several creatures in the same faction', () => {
		const factionId = createUuid();
		const low = staticTurn(2);
		const high = staticTurn(6);
		const middle = staticTurn(4);

		expect(
			order([
				createCreature(factionId, [low, middle]),
				createCreature(factionId, []),
				createCreature(factionId, [high])
			])
		).toEqual([high.id, middle.id, low.id]);
	});

	it('does not change the order of rolled turns when regenerated with the same results', () => {
		const factionId = createUuid();
		const first = rolledTurn();
		const second = rolledTurn();
		const creatures = [createCreature(factionId, [first, second])];
		const results = { [first.id]: 4, [second.id]: 11 };

		expect(order(creatures, results)).toEqual(order(creatures, results));
	});

	it('does not mutate the challenge or the initiative results', () => {
		const factionId = createUuid();
		const roll = rolledTurn();
		const fixed = createTurn({ kind: 'fixed-position', from: 'top', position: 1 });
		const challenge = createChallenge([createCreature(factionId, [roll, staticTurn(3), fixed])]);
		const results = { [roll.id]: 5 };
		const challengeBefore = structuredClone(challenge);
		const resultsBefore = structuredClone(results);

		generateTurnOrder(challenge, results);

		expect(challenge).toEqual(challengeBefore);
		expect(results).toEqual(resultsBefore);
	});

	it('applies several fixed positions from the top in order', () => {
		const factionId = createUuid();
		const first = staticTurn(9);
		const second = staticTurn(8);
		const secondFromTop = createTurn({ kind: 'fixed-position', from: 'top', position: 1 });
		const thirdFromTop = createTurn({ kind: 'fixed-position', from: 'top', position: 2 });

		expect(
			order([createCreature(factionId, [first, second, secondFromTop, thirdFromTop])])
		).toEqual([secondFromTop.id, thirdFromTop.id, first.id, second.id]);
	});

	it('orders a list consisting only of fixed positions', () => {
		const factionId = createUuid();
		const top = createTurn({ kind: 'fixed-position', from: 'top', position: 1 });
		const bottom = createTurn({ kind: 'fixed-position', from: 'bottom', position: 1 });

		expect(order([createCreature(factionId, [top, bottom])])).toEqual([top.id, bottom.id]);
	});

	it('clamps relative placements that fall beyond either end of the list', () => {
		const factionId = createUuid();
		const first = staticTurn(9);
		const second = staticTurn(8);
		const tooEarly = createTurn({
			kind: 'relative-position',
			relation: 'before',
			distance: 5,
			targetTurnId: first.id
		});
		const tooLate = createTurn({
			kind: 'relative-position',
			relation: 'after',
			distance: 5,
			targetTurnId: second.id
		});

		expect(order([createCreature(factionId, [first, second, tooEarly, tooLate])])).toEqual([
			tooEarly.id,
			first.id,
			second.id,
			tooLate.id
		]);
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
