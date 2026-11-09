import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InitiativeTurnCard from './InitiativeTurnCard.svelte';

afterEach(cleanup);

function cardProps() {
	return {
		title: 'Sentinel B - Turn 1',
		mode: 'app' as const,
		factionColor: undefined,
		result: undefined,
		inputValue: '',
		isInvalid: false,
		canRoll: true,
		isInputLocked: false,
		isRollLocked: false,
		onInput: vi.fn(),
		onRoll: vi.fn()
	};
}

describe('InitiativeTurnCard', () => {
	it('keeps app sizing through rolling, rerolling, and invalid-stat feedback', async () => {
		const props = cardProps();
		const { container, rerender } = render(InitiativeTurnCard, props);
		const card = container.querySelector('.initiative-card-tone');

		expect(card?.classList.contains('initiative-card-tone--app')).toBe(true);
		expect(screen.queryByRole('status')).toBeNull();
		await fireEvent.click(
			screen.getByRole('button', { name: `Roll initiative for ${props.title}` })
		);
		expect(props.onRoll).toHaveBeenCalledOnce();

		for (const result of [0, 9, 18]) {
			await rerender({ result });
			expect(container.querySelector('.initiative-card-tone')).toBe(card);
			expect(card?.classList.contains('initiative-card-tone--app')).toBe(true);
			expect(screen.getByText(`Initiative result: ${result}`)).toBeTruthy();
			await fireEvent.click(
				screen.getByRole('button', { name: `Reroll initiative for ${props.title}` })
			);
		}
		expect(props.onRoll).toHaveBeenCalledTimes(4);

		await rerender({ canRoll: false });
		expect(card?.classList.contains('initiative-card-tone--app')).toBe(true);
		expect(
			screen
				.getByText('Cannot roll because the initiative stat is missing or invalid.')
				.getAttribute('role')
		).toBe('status');
		const reroll = screen.getByRole('button', {
			name: `Reroll initiative for ${props.title}`
		}) as HTMLButtonElement;
		expect(reroll.disabled).toBe(true);

		await rerender({ canRoll: true, result: undefined });
		expect(card?.classList.contains('initiative-card-tone--app')).toBe(true);
		expect(screen.queryByRole('status')).toBeNull();
		expect(screen.getByRole('button', { name: `Roll initiative for ${props.title}` })).toBeTruthy();
	});

	it('leaves manual-entry cards outside the app sizing rule', () => {
		const { container } = render(InitiativeTurnCard, { ...cardProps(), mode: 'manual' });

		expect(container.querySelector('.initiative-card-tone--app')).toBeNull();
		expect(
			screen.getByRole('spinbutton', { name: 'Initiative for Sentinel B - Turn 1' })
		).toBeTruthy();
	});
});
