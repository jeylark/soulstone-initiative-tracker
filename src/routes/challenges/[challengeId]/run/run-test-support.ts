import type { Challenge, StableId } from '#lib/challenge';
import { createSetupChallenge } from '../../../view-test-support';

export const ariaTurnId = '00000000-0000-4000-8000-000000000023' as StableId;
export const rookTurnId = '00000000-0000-4000-8000-000000000024' as StableId;

export function createRunChallenge(): Challenge {
	const challenge = createSetupChallenge();
	challenge.name = 'Ashen Company';
	challenge.creatures = [
		{
			id: '00000000-0000-4000-8000-000000000025' as StableId,
			kind: 'character',
			name: 'Aria',
			factionId: '00000000-0000-4000-8000-000000000002' as StableId,
			isHidden: false,
			turns: [{ id: ariaTurnId, initiative: { kind: 'roll', mode: 'manual' } }]
		},
		{
			id: '00000000-0000-4000-8000-000000000026' as StableId,
			kind: 'character',
			name: 'Rook',
			factionId: '00000000-0000-4000-8000-000000000002' as StableId,
			isHidden: false,
			turns: [{ id: rookTurnId, initiative: { kind: 'roll', mode: 'manual' } }]
		}
	];
	challenge.runState = {
		initiativeResults: { [ariaTurnId]: 6, [rookTurnId]: 12 },
		generatedTurnOrder: [
			{ kind: 'turn', turnId: ariaTurnId },
			{ kind: 'turn', turnId: rookTurnId },
			{ kind: 'spawn' }
		]
	};
	return challenge;
}
