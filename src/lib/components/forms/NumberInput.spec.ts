import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NumberInput from './NumberInput.svelte';

afterEach(() => {
	cleanup();
});

describe('NumberInput', () => {
	it('participates in shared label, control and feedback rows', () => {
		const { container } = render(NumberInput, { label: 'A label that may wrap' });
		const field = screen.getByRole('spinbutton', { name: 'A label that may wrap' });
		const wrapper = field.closest('.form-field-messages');
		const label = field.closest('.form-field');
		const styles = readFileSync('src/lib/components/forms/form-controls.css', 'utf8');

		expect(wrapper?.parentElement).toBe(container);
		expect(label?.querySelector('.form-control-label')?.textContent).toBe('A label that may wrap');
		expect(wrapper?.querySelector('.form-control-message-area')).toBeTruthy();
		expect(styles).toMatch(
			/\.form-group\s*>\s*\.form-field-messages\s*\{[^}]*grid-template-rows:\s*subgrid/s
		);
		expect(styles).toMatch(
			/\.form-group\s*>\s*\.form-field-messages\s*>\s*\.form-field\s*\{[^}]*grid-template-rows:\s*subgrid/s
		);
	});

	it('uses shared wrapped-label row alignment', () => {
		const { container } = render(NumberInput, { label: 'Initiative' });

		expect(container.querySelector('.form-field-messages--align-labels')).toBeTruthy();
	});

	it('applies a caller-owned class to the label', () => {
		render(NumberInput, { label: 'Initiative stat', labelClass: 'npc-type-field-label' });

		expect(screen.getByText('Initiative stat').classList.contains('npc-type-field-label')).toBe(
			true
		);
	});

	it('preserves numeric constraints and forwards input events', async () => {
		const oninput = vi.fn();
		render(NumberInput, {
			label: 'Initiative stat',
			id: 'initiative-stat-input',
			['aria-describedby']: 'initiative-stat-help',
			value: 2,
			min: 1,
			step: 1,
			oninput
		});

		const input = screen.getByRole('spinbutton', { name: 'Initiative stat' }) as HTMLInputElement;
		expect(input.type).toBe('number');
		expect(input.id).toBe('initiative-stat-input');
		expect(input.getAttribute('aria-describedby')).toBe('initiative-stat-help');
		expect(input.value).toBe('2');
		expect(input.min).toBe('1');
		expect(input.step).toBe('1');
		expect(input.closest('label')?.textContent).toContain('Initiative stat');

		await fireEvent.input(input, { target: { value: '4' } });
		expect(oninput).toHaveBeenCalledOnce();
	});

	it('shows warning and invalid states accessibly', () => {
		const { unmount } = render(NumberInput, {
			label: 'High initiative',
			hasWarning: true,
			warningMessage: 'Values above 18 are valid.'
		});

		const warningInput = screen.getByRole('spinbutton', {
			name: 'High initiative'
		}) as HTMLInputElement;
		expect(warningInput.classList.contains('form-control--warning')).toBe(true);
		expect(warningInput.getAttribute('aria-invalid')).toBeNull();
		const warning = screen.getByRole('status');
		expect(warning.textContent).toBe('Values above 18 are valid.');
		expect(warningInput.getAttribute('aria-describedby')).toBe(warning.id);

		unmount();
		render(NumberInput, {
			label: 'Invalid initiative',
			isInvalid: true,
			invalidMessage: 'Enter a non-negative whole number.'
		});

		const invalidInput = screen.getByRole('spinbutton', {
			name: 'Invalid initiative'
		}) as HTMLInputElement;
		expect(invalidInput.classList.contains('form-control--invalid')).toBe(true);
		expect(invalidInput.getAttribute('aria-invalid')).toBe('true');
		const invalidMessage = screen.getByRole('alert');
		expect(invalidMessage.textContent).toBe('Enter a non-negative whole number.');
		expect(invalidInput.getAttribute('aria-describedby')).toBe(invalidMessage.id);
	});

	it('keeps one message area available as validation messages change', () => {
		const { rerender } = render(NumberInput, {
			label: 'Initiative',
			value: '19',
			['aria-describedby']: 'initiative-help'
		});

		const input = screen.getByRole('spinbutton', { name: 'Initiative' }) as HTMLInputElement;
		const messageArea = input.parentElement?.parentElement?.querySelectorAll(
			'.form-control-message-area'
		);
		expect(messageArea).toHaveLength(1);
		expect(input.value).toBe('19');
		expect(input.getAttribute('aria-describedby')).toBe('initiative-help');
		expect(screen.queryByRole('status')).toBeNull();
		expect(screen.queryByRole('alert')).toBeNull();
		expect(messageArea?.[0]?.querySelectorAll('[role="alert"], [role="status"]')).toHaveLength(0);

		rerender({
			label: 'Initiative',
			value: '19',
			['aria-describedby']: 'initiative-help',
			hasWarning: true,
			warningMessage: 'Values above 18 are valid.',
			isInvalid: true,
			invalidMessage: 'Enter a non-negative whole number.'
		});

		const warning = screen.getByRole('status');
		const invalidMessage = screen.getByRole('alert');
		expect(screen.getAllByText(/Values above 18|Enter a non-negative/)).toHaveLength(2);
		expect(messageArea?.[0]?.querySelectorAll('[role="alert"], [role="status"]')).toHaveLength(2);
		expect(input.value).toBe('19');
		expect(input.getAttribute('aria-describedby')).toBe(
			`initiative-help ${invalidMessage.id} ${warning.id}`
		);

		rerender({
			label: 'Initiative',
			value: '19',
			['aria-describedby']: 'initiative-help',
			hasWarning: false,
			warningMessage: undefined,
			isInvalid: false,
			invalidMessage: undefined
		});

		expect(input.value).toBe('19');
		expect(input.getAttribute('aria-describedby')).toBe('initiative-help');
		expect(screen.queryByRole('status')).toBeNull();
		expect(screen.queryByRole('alert')).toBeNull();
		expect(
			input.parentElement?.parentElement?.querySelectorAll('.form-control-message-area')
		).toHaveLength(1);
		expect(messageArea?.[0]?.querySelectorAll('[role="alert"], [role="status"]')).toHaveLength(0);
	});
});
