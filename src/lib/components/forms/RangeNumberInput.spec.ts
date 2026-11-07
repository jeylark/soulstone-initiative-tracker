import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RangeNumberInput from './RangeNumberInput.svelte';

afterEach(() => {
	cleanup();
});

describe('RangeNumberInput', () => {
	it('renders labeled controls with independent slider and number constraints', async () => {
		const onSliderInput = vi.fn();
		const onNumberInput = vi.fn();
		render(RangeNumberInput, {
			sliderLabel: 'Fairness weight slider',
			numberLabel: 'Fairness weight value',
			isLabelVisuallyHidden: true,
			sliderId: 'fairness-weight',
			numberClass: 'fairness-weight-input',
			value: 12.75,
			min: 0,
			max: 10,
			step: 0.01,
			numberMin: 0,
			numberStep: 'any',
			onSliderInput,
			onNumberInput
		});

		const slider = screen.getByRole('slider', {
			name: 'Fairness weight slider'
		}) as HTMLInputElement;
		const number = screen.getByRole('spinbutton', {
			name: 'Fairness weight value'
		}) as HTMLInputElement;

		expect(slider.id).toBe('fairness-weight');
		expect(slider.min).toBe('0');
		expect(slider.max).toBe('10');
		expect(slider.step).toBe('0.01');
		expect(slider.value).toBe('10');
		expect(number.value).toBe('12.75');
		expect(number.min).toBe('0');
		expect(number.step).toBe('any');
		expect(number.classList.contains('fairness-weight-input')).toBe(true);

		await fireEvent.input(slider, { target: { value: '8.5' } });
		await fireEvent.input(number, { target: { value: '14.25' } });

		expect(onSliderInput).toHaveBeenCalledOnce();
		expect(onNumberInput).toHaveBeenCalledOnce();
	});
});
