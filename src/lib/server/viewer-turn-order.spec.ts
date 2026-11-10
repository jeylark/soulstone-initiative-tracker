import { describe, expect, it } from 'vitest';
import { createRunChallenge } from '../../routes/challenges/[challengeId]/run/run-test-support';
import { createViewerTurnOrder } from './viewer-turn-order';

describe('createViewerTurnOrder', () => {
	it('omits hidden turns and keeps visible turns and Spawn in order', () => {
		const challenge = createRunChallenge();
		challenge.creatures[1]!.isHidden = true;

		const turnOrder = createViewerTurnOrder(challenge);

		expect(turnOrder.map((item) => (item.kind === 'turn' ? item.display.label : 'Spawn'))).toEqual([
			'Aria',
			'Spawn'
		]);
		expect(JSON.stringify(turnOrder)).not.toContain('Rook');
	});

	it('returns an empty order when the challenge has not started running', () => {
		const challenge = createRunChallenge();
		delete challenge.runState!.generatedTurnOrder;

		expect(createViewerTurnOrder(challenge)).toEqual([]);
	});
});
