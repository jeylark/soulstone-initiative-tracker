import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUuid, type ChallengeCreature, type TurnOrderTurnDisplayItem } from '#lib/challenge';
import Turn from './Turn.svelte';

afterEach(cleanup);

function createTurnItem(initiative: number | undefined): TurnOrderTurnDisplayItem {
	const turnId = createUuid();
	const creature: ChallengeCreature = {
		id: createUuid(),
		kind: 'character',
		name: 'Aria',
		factionId: createUuid(),
		isHidden: false,
		turns: [{ id: turnId, initiative: { kind: 'roll', mode: 'app' } }]
	};

	return {
		kind: 'turn',
		turnId,
		position: 1,
		display: {
			creature,
			faction: undefined,
			creatureName: 'Aria',
			label: 'Aria',
			initiative: { kind: 'roll', mode: 'app' },
			isHidden: false
		},
		initiative
	};
}

describe('Turn', () => {
	it('shows a saved initiative value of zero', () => {
		render(Turn, {
			props: { item: createTurnItem(0), onVisibilityChange: vi.fn() }
		});

		expect(screen.getByText('Initiative: 0')).toBeTruthy();
	});

	it('omits an initiative when no numeric value exists', () => {
		render(Turn, {
			props: { item: createTurnItem(undefined), onVisibilityChange: vi.fn() }
		});

		expect(screen.queryByText(/^Initiative:/)).toBeNull();
	});

	it('does not show an initiative for Spawn', () => {
		render(Turn, {
			props: {
				item: { kind: 'spawn', position: 1 },
				onVisibilityChange: vi.fn()
			}
		});

		expect(screen.queryByText(/^Initiative:/)).toBeNull();
	});
});
