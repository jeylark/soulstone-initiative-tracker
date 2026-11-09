import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TextInput from './TextInput.svelte';

afterEach(() => {
	cleanup();
});

describe('TextInput', () => {
	it('renders a labeled text input and forwards input events and native attributes', async () => {
		const oninput = vi.fn();
		render(TextInput, {
			label: 'Challenge name',
			value: 'Encounter',
			autocomplete: 'off',
			class: 'wide-control',
			title: 'Encounter name',
			oninput
		});

		const input = screen.getByRole('textbox', { name: 'Challenge name' }) as HTMLInputElement;
		expect(input.type).toBe('text');
		expect(input.value).toBe('Encounter');
		expect(input.autocomplete).toBe('off');
		expect(input.title).toBe('Encounter name');
		expect(input.classList.contains('form-control')).toBe(true);
		expect(input.classList.contains('wide-control')).toBe(true);
		expect(input.closest('label')?.textContent).toContain('Challenge name');

		await fireEvent.input(input, { target: { value: 'New encounter' } });
		expect(oninput).toHaveBeenCalledOnce();
	});

	it('shows warning and invalid messages accessibly', () => {
		render(TextInput, {
			label: 'Name',
			['aria-describedby']: 'help',
			hasWarning: true,
			warningMessage: 'Careful.',
			isInvalid: true,
			invalidMessage: 'Not allowed.'
		});

		const control = screen.getByRole('textbox', { name: 'Name' });
		const warning = screen.getByRole('status');
		const invalid = screen.getByRole('alert');
		const messageArea = control
			.closest('.form-field-messages')
			?.querySelector('.form-control-message-area');
		expect(warning.textContent).toBe('Careful.');
		expect(invalid.textContent).toBe('Not allowed.');
		expect(messageArea?.querySelectorAll('[role="alert"], [role="status"]')).toHaveLength(2);
		expect(control.classList.contains('form-control--warning')).toBe(true);
		expect(control.classList.contains('form-control--invalid')).toBe(true);
		expect(control.getAttribute('aria-invalid')).toBe('true');
		expect(control.getAttribute('aria-describedby')).toBe(`help ${invalid.id} ${warning.id}`);
	});
});
