import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	createUuid,
	type ChallengeCreature,
	type TurnOrderTurnDisplayItem,
	type ViewerTurnOrderDisplayItem
} from '#lib/challenge';
import TurnOrderItem from './TurnOrderItem.svelte';

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

describe('TurnOrderItem', () => {
	it('shows a saved initiative value of zero and omits a missing value', () => {
		const { unmount } = render(TurnOrderItem, {
			props: { item: createTurnItem(0) }
		});

		expect(screen.getByText('Initiative: 0')).toBeTruthy();
		unmount();

		render(TurnOrderItem, { props: { item: createTurnItem(undefined) } });
		expect(screen.queryByText(/^Initiative:/)).toBeNull();
	});

	it('renders the faction, creature label, and faction color', () => {
		const { container } = render(TurnOrderItem, {
			props: { item: createTurnItem(6, false, true) }
		});
		const card = container.querySelector<HTMLElement>('.card');

		expect(screen.getByRole('heading', { name: 'Players' })).toBeTruthy();
		expect(screen.getByText('Aria', { selector: '.turn-order-creature-name' })).toBeTruthy();
		expect(card?.classList.contains('card--accented')).toBe(true);
		expect(card?.style.getPropertyValue('--card-accent-color')).toBe(
			'light-dark(#1f5fbf, #5c9dff)'
		);
		expect(card?.classList.contains('card--muted')).toBe(false);
	});

	it('uses a fallback title when the faction is missing', () => {
		render(TurnOrderItem, { props: { item: createTurnItem(6) } });

		expect(screen.getByRole('heading', { name: 'Unknown faction' })).toBeTruthy();
	});

	it('shows the provided turn label without exposing its order position', () => {
		const item = createTurnItem(6);
		const itemWithTurnLabel = {
			...item,
			display: { ...item.display, label: 'Aria - Turn 2' }
		};
		const { container } = render(TurnOrderItem, { props: { item: itemWithTurnLabel } });

		expect(
			screen.getByText('Aria - Turn 2', { selector: '.turn-order-creature-name' })
		).toBeTruthy();
		expect(container.querySelector('.card')?.classList.contains('card--muted')).toBe(false);
		expect(container.querySelector('.turn-order-position')).toBeNull();
	});

	it('shows the visibility control only when a callback is provided', async () => {
		const item = createTurnItem(undefined, true);
		const onVisibilityChange = vi.fn();
		const { unmount } = render(TurnOrderItem, {
			props: { item, onVisibilityChange }
		});
		expect(document.querySelector('.card')?.classList.contains('card--muted')).toBe(true);

		const checkbox = screen.getByRole('checkbox', {
			name: 'Hidden from viewers: Aria'
		}) as HTMLInputElement;
		expect(checkbox.checked).toBe(true);
		expect(checkbox.closest('label')?.textContent?.trim()).toBe('Hidden');
		expect(screen.queryByText('Hidden', { selector: 'p' })).toBeNull();
		await fireEvent.click(checkbox);
		expect(onVisibilityChange).toHaveBeenCalledWith(item.display.creature.id, false);

		unmount();
		render(TurnOrderItem, { props: { item } });
		expect(screen.queryByRole('checkbox')).toBeNull();
	});

	it('renders Spawn without turn-only content', () => {
		render(TurnOrderItem, { props: { item: { kind: 'spawn', position: 1 } } });

		expect(screen.getByText('Spawn', { selector: '.turn-order-creature-name' })).toBeTruthy();
		expect(screen.queryByText(/^Initiative:/)).toBeNull();
		expect(screen.queryByRole('checkbox')).toBeNull();
		expect(screen.queryByText('1')).toBeNull();
	});

	it('renders minimal viewer data without exposing a visibility control', () => {
		const item: ViewerTurnOrderDisplayItem = {
			kind: 'turn',
			turnId: createUuid(),
			display: {
				faction: { name: 'Players', color: 'blue' },
				label: 'Aria',
				isHidden: false
			},
			initiative: 6
		};
		render(TurnOrderItem, { props: { item, onVisibilityChange: vi.fn() } });

		expect(screen.getByRole('heading', { name: 'Players' })).toBeTruthy();
		expect(screen.getByText('Aria', { selector: '.turn-order-creature-name' })).toBeTruthy();
		expect(screen.getByText('Initiative: 6')).toBeTruthy();
		expect(screen.queryByRole('checkbox')).toBeNull();
	});
});
