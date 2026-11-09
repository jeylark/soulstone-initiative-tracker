import { describe, expect, it } from 'vitest';
import type { ChallengeRunState, StableId } from '../core/model';
import { advanceTurn } from './turn-advance';

const a = '00000000-0000-4000-8000-000000000001' as StableId;
const b = '00000000-0000-4000-8000-000000000002' as StableId;
const c = '00000000-0000-4000-8000-000000000003' as StableId;

describe('advanceTurn', () => {
	it('moves the first entry to the end without counting a spawn', () => {
		const runState: ChallengeRunState = {
			initiativeResults: {},
			generatedTurnOrder: [
				{ kind: 'turn', turnId: a },
				{ kind: 'turn', turnId: b },
				{ kind: 'spawn' }
			]
		};

		expect(advanceTurn(runState)).toEqual({
			initiativeResults: {},
			generatedTurnOrder: [
				{ kind: 'turn', turnId: b },
				{ kind: 'spawn' },
				{ kind: 'turn', turnId: a }
			]
		});
	});

	it('increments the spawn count when the spawn entry is advanced', () => {
		const runState: ChallengeRunState = {
			initiativeResults: {},
			spawnCount: 2,
			generatedTurnOrder: [{ kind: 'spawn' }, { kind: 'turn', turnId: a }]
		};

		const next = advanceTurn(runState);

		expect(next.spawnCount).toBe(3);
		expect(next.generatedTurnOrder).toEqual([{ kind: 'turn', turnId: a }, { kind: 'spawn' }]);
	});

	it('skips consecutive hidden turns without removing or reordering them', () => {
		const runState: ChallengeRunState = {
			initiativeResults: {},
			generatedTurnOrder: [
				{ kind: 'turn', turnId: a },
				{ kind: 'turn', turnId: b },
				{ kind: 'turn', turnId: c },
				{ kind: 'spawn' }
			]
		};

		expect(advanceTurn(runState, new Set([b, c]))).toEqual({
			initiativeResults: {},
			generatedTurnOrder: [
				{ kind: 'spawn' },
				{ kind: 'turn', turnId: a },
				{ kind: 'turn', turnId: b },
				{ kind: 'turn', turnId: c }
			]
		});
	});

	it('moves away from a hidden current turn and stops at the next visible turn', () => {
		const runState: ChallengeRunState = {
			initiativeResults: {},
			generatedTurnOrder: [
				{ kind: 'turn', turnId: a },
				{ kind: 'turn', turnId: b },
				{ kind: 'turn', turnId: c },
				{ kind: 'spawn' }
			]
		};

		expect(advanceTurn(runState, new Set([a, b]))).toEqual({
			initiativeResults: {},
			generatedTurnOrder: [
				{ kind: 'turn', turnId: c },
				{ kind: 'spawn' },
				{ kind: 'turn', turnId: a },
				{ kind: 'turn', turnId: b }
			]
		});
	});

	it('stops at Spawn before counting it as completed', () => {
		const runState: ChallengeRunState = {
			initiativeResults: {},
			generatedTurnOrder: [
				{ kind: 'turn', turnId: a },
				{ kind: 'turn', turnId: b },
				{ kind: 'spawn' }
			]
		};

		const next = advanceTurn(runState, new Set([b]));

		expect(next.spawnCount).toBeUndefined();
		expect(next.generatedTurnOrder).toEqual([
			{ kind: 'spawn' },
			{ kind: 'turn', turnId: a },
			{ kind: 'turn', turnId: b }
		]);
	});

	it('starts counting from zero and does not mutate its input', () => {
		const runState: ChallengeRunState = {
			initiativeResults: {},
			generatedTurnOrder: [{ kind: 'spawn' }]
		};

		expect(advanceTurn(runState).spawnCount).toBe(1);
		expect(runState.spawnCount).toBeUndefined();
		expect(runState.generatedTurnOrder).toEqual([{ kind: 'spawn' }]);
	});

	it('returns the run state unchanged when there is no generated order', () => {
		expect(advanceTurn({ initiativeResults: {} })).toEqual({ initiativeResults: {} });
	});
});
