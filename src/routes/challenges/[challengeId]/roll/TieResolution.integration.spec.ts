import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TieResolution from './TieResolution.svelte';
import type { StableId, TurnDisplay } from '#lib/challenge';

afterEach(cleanup);

const first = '00000000-0000-4000-8000-000000000001' as StableId;
const second = '00000000-0000-4000-8000-000000000002' as StableId;
const lookup = new Map([
	[first, { label: 'Aria' }],
	[second, { label: 'Rook' }]
]) as unknown as ReadonlyMap<StableId, TurnDisplay>;

describe('TieResolution', () => {
	it('renders nothing without ties', () => {
		render(TieResolution, {
			groups: [],
			decisions: [],
			turnDisplayLookup: lookup,
			onDecide: vi.fn()
		});

		expect(screen.queryByRole('region', { name: 'Initiative ties' })).toBeNull();
	});

	it('shows an unresolved group and confirms its current order', async () => {
		const onDecide = vi.fn();
		render(TieResolution, {
			groups: [[first, second]],
			decisions: [],
			turnDisplayLookup: lookup,
			onDecide
		});

		expect(screen.getByText('Needs ordering')).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Confirm default order for tie 1' }));

		expect(onDecide).toHaveBeenCalledWith([first, second]);
	});

	it('reorders a turn and shows saved decisions as ordered', async () => {
		const onDecide = vi.fn();
		render(TieResolution, {
			groups: [[first, second]],
			decisions: [[first, second]],
			turnDisplayLookup: lookup,
			onDecide
		});

		expect(screen.getByText('Ordered')).toBeTruthy();
		const group = screen
			.getByRole('button', { name: 'Move Rook earlier' })
			.closest('.button-group');
		expect(group).not.toBeNull();
		expect(screen.getByRole('button', { name: 'Move Rook later' }).closest('.button-group')).toBe(
			group
		);
		expect(
			(screen.getByRole('button', { name: /Confirm default order/ }) as HTMLButtonElement).disabled
		).toBe(true);
		await fireEvent.click(screen.getByRole('button', { name: 'Move Rook earlier' }));

		expect(onDecide).toHaveBeenCalledWith([second, first]);
		expect(
			(screen.getByRole('button', { name: 'Move Aria earlier' }) as HTMLButtonElement).disabled
		).toBe(true);
	});
});
