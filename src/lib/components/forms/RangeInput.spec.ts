import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RangeInput from './RangeInput.svelte';

afterEach(() => {
	cleanup();
});

describe('RangeInput', () => {
	it('preserves slider bounds and forwards input events', async () => {
		const oninput = vi.fn();
		render(RangeInput, {
			label: 'Fairness weight slider',
			isLabelVisuallyHidden: true,
			value: 3,
			min: 0,
			max: 10,
			step: 0.01,
			oninput
		});

		const input = screen.getByRole('slider', {
			name: 'Fairness weight slider'
		}) as HTMLInputElement;
		expect(input.type).toBe('range');
		expect(input.min).toBe('0');
		expect(input.max).toBe('10');
		expect(input.step).toBe('0.01');
		expect(input.closest('label')?.querySelector('.visually-hidden')?.textContent).toBe(
			'Fairness weight slider'
		);

		await fireEvent.input(input, { target: { value: '4.25' } });
		expect(oninput).toHaveBeenCalledOnce();
	});
});
