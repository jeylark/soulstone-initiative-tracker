import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RangeInput from './RangeInput.svelte';

afterEach(() => {
	cleanup();
});

describe('RangeInput', () => {
	it('renders optional supporting content after its controls', () => {
		render(RangeInput, {
			label: 'Fairness',
			value: 1,
			min: 0,
			max: 10,
			step: 1,
			description: createRawSnippet(() => ({ render: () => '<p>Supporting detail</p>' }))
		});
		const field = screen.getByRole('group', { name: 'Fairness' }).closest('.form-field-messages');
		expect(field?.querySelector('.form-control-message-area')?.textContent).toContain(
			'Supporting detail'
		);
	});

	it('exposes a shared label and a separately aligned control group', () => {
		render(RangeInput, { label: 'Fairness', value: 1, min: 0, max: 10, step: 1 });
		const group = screen.getByRole('group', { name: 'Fairness' });
		const field = group.closest('.form-field-messages');
		expect(field?.querySelector('.form-control-label')?.textContent).toBe('Fairness');
		expect(group.parentElement).toBe(field);
	});

	it('uses shared wrapped-label row alignment', () => {
		const { container } = render(RangeInput, {
			label: 'Fairness weight',
			value: 4,
			min: 0,
			max: 10,
			step: 1
		});

		expect(container.querySelector('.form-field-messages--align-labels')).toBeTruthy();
	});

	it('renders a shared label and forwards both control input events', async () => {
		const onSliderInput = vi.fn();
		const onNumberInput = vi.fn();
		render(RangeInput, {
			label: 'Fairness weight',
			isLabelVisuallyHidden: true,
			id: 'fairness-weight',
			value: 12.75,
			min: 0,
			max: 10,
			step: 0.01,
			numberMin: 0,
			numberStep: 'any',
			onSliderInput,
			onNumberInput
		});

		const group = screen.getByRole('group', { name: 'Fairness weight' });
		const slider = screen.getByRole('slider', {
			name: 'Fairness weight slider'
		}) as HTMLInputElement;
		const number = screen.getByRole('spinbutton', {
			name: 'Fairness weight value'
		}) as HTMLInputElement;

		expect(slider.type).toBe('range');
		expect(slider.id).toBe('fairness-weight');
		expect(slider.min).toBe('0');
		expect(slider.max).toBe('10');
		expect(slider.step).toBe('0.01');
		expect(slider.value).toBe('10');
		expect(number.type).toBe('number');
		expect(number.value).toBe('12.75');
		expect(number.min).toBe('0');
		expect(number.max).toBe('');
		expect(number.step).toBe('any');
		expect(slider.closest('fieldset')).toBe(group);
		expect(number.closest('fieldset')).toBe(group);

		await fireEvent.input(slider, { target: { value: '4.25' } });
		await fireEvent.input(number, { target: { value: '14.5' } });
		expect(onSliderInput).toHaveBeenCalledOnce();
		expect(onNumberInput).toHaveBeenCalledOnce();
	});

	it('shares warning and error associations across both controls', () => {
		const { rerender } = render(RangeInput, {
			label: 'Initiative',
			value: 19,
			min: 0,
			max: 10,
			step: 0.01,
			['aria-describedby']: 'initiative-help',
			hasWarning: true,
			warningMessage: 'Values above 18 are valid.',
			isInvalid: true,
			invalidMessage: 'Enter a non-negative whole number.'
		});

		const slider = screen.getByRole('slider', { name: 'Initiative slider' }) as HTMLInputElement;
		const number = screen.getByRole('spinbutton', { name: 'Initiative value' }) as HTMLInputElement;
		const warning = screen.getByRole('status');
		const invalid = screen.getByRole('alert');
		const messageArea = slider
			.closest('.form-field-messages')
			?.querySelector('.form-control-message-area');

		expect(warning.textContent).toBe('Values above 18 are valid.');
		expect(invalid.textContent).toBe('Enter a non-negative whole number.');
		expect(messageArea?.querySelectorAll('[role="alert"], [role="status"]')).toHaveLength(2);
		expect(slider.classList.contains('form-control--warning')).toBe(true);
		expect(number.classList.contains('form-control--warning')).toBe(true);
		expect(slider.getAttribute('aria-invalid')).toBe('true');
		expect(number.getAttribute('aria-invalid')).toBe('true');
		expect(slider.getAttribute('aria-describedby')).toBe(
			`initiative-help ${invalid.id} ${warning.id}`
		);
		expect(number.getAttribute('aria-describedby')).toBe(
			`initiative-help ${invalid.id} ${warning.id}`
		);

		rerender({
			label: 'Initiative',
			value: 19,
			min: 0,
			max: 10,
			step: 0.01,
			['aria-describedby']: 'initiative-help',
			hasWarning: false,
			warningMessage: undefined,
			isInvalid: true,
			invalidMessage: 'Enter a non-negative whole number.'
		});

		const invalidMessage = screen.getByRole('alert');
		expect(invalidMessage.textContent).toBe('Enter a non-negative whole number.');
		expect(slider.classList.contains('form-control--invalid')).toBe(true);
		expect(number.classList.contains('form-control--invalid')).toBe(true);
		expect(slider.getAttribute('aria-invalid')).toBe('true');
		expect(number.getAttribute('aria-invalid')).toBe('true');
		expect(slider.getAttribute('aria-describedby')).toBe(`initiative-help ${invalidMessage.id}`);
		expect(number.getAttribute('aria-describedby')).toBe(`initiative-help ${invalidMessage.id}`);

		rerender({
			label: 'Initiative',
			value: 19,
			min: 0,
			max: 10,
			step: 0.01,
			['aria-describedby']: 'initiative-help',
			hasWarning: false,
			warningMessage: undefined,
			isInvalid: false,
			invalidMessage: undefined
		});

		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.queryByRole('status')).toBeNull();
		expect(slider.getAttribute('aria-describedby')).toBe('initiative-help');
		expect(number.getAttribute('aria-describedby')).toBe('initiative-help');
	});
});
