import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUuid, type ChallengeCreature, type TurnOrderTurnDisplayItem } from '#lib/challenge';
import Turn from './Turn.svelte';

afterEach(cleanup);

function createTurnItem(
	initiative: number | undefined,
	isHidden = false,
	hasFaction = false
): TurnOrderTurnDisplayItem {
	const turnId = createUuid();
	const faction = hasFaction
		? { id: createUuid(), name: 'Players', color: 'blue' as const }
		: undefined;
	const creature: ChallengeCreature = {
		id: createUuid(),
		kind: 'character',
		name: 'Aria',
		factionId: faction?.id ?? createUuid(),
		isHidden,
		turns: [{ id: turnId, initiative: { kind: 'roll', mode: 'app' } }]
	};

	return {
		kind: 'turn',
		turnId,
		position: 1,
		display: {
			creature,
			faction,
			creatureName: 'Aria',
			label: 'Aria',
			initiative: { kind: 'roll', mode: 'app' },
			isHidden
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

	it('shows a short visible hidden label with a contextual accessible name', () => {
		const item = createTurnItem(undefined, true);
		render(Turn, { props: { item, onVisibilityChange: vi.fn() } });

		const checkbox = screen.getByRole('checkbox', {
			name: 'Hidden from viewers: Aria'
		}) as HTMLInputElement;
		expect(checkbox.checked).toBe(true);
		expect(checkbox.closest('label')?.textContent?.trim()).toBe('Hidden');
		expect(screen.queryByText('Hidden', { selector: 'p' })).toBeNull();
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

	it('does not render order positions for turns or Spawn', () => {
		const { container, unmount } = render(Turn, {
			props: { item: createTurnItem(6), onVisibilityChange: vi.fn() }
		});
		expect(container.querySelector('.turn-order-position')).toBeNull();

		unmount();
		render(Turn, {
			props: {
				item: { kind: 'spawn', position: 2 },
				onVisibilityChange: vi.fn()
			}
		});
		expect(screen.queryByText('2')).toBeNull();
	});

	it('keeps faction color styling without displaying faction names', () => {
		const { container } = render(Turn, {
			props: { item: createTurnItem(6, false, true), onVisibilityChange: vi.fn() }
		});

		expect(screen.queryByText('Players')).toBeNull();
		expect(screen.getByRole('heading', { name: 'Aria' })).toBeTruthy();
		expect(
			container
				.querySelector<HTMLElement>('.turn-order-card-tone')
				?.style.getPropertyValue('--faction-color')
		).toBe('light-dark(#1f5fbf, #5c9dff)');
	});
});
