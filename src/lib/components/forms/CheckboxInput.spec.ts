import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CheckboxInput from './CheckboxInput.svelte';

afterEach(() => {
	cleanup();
});

describe('CheckboxInput', () => {
	it('renders a labeled checkbox and forwards native attributes and change events', async () => {
		const onchange = vi.fn();
		render(CheckboxInput, {
			label: 'Hidden from viewers',
			// These keys intentionally match native HTML input attributes.
			// eslint-disable-next-line @typescript-eslint/naming-convention -- Preserve the native attribute name.
			checked: true,
			id: 'visibility-checkbox',
			// eslint-disable-next-line @typescript-eslint/naming-convention -- Preserve the native attribute name.
			disabled: false,
			class: 'visibility-control',
			onchange
		});

		const input = screen.getByRole('checkbox', { name: 'Hidden from viewers' }) as HTMLInputElement;
		expect(input.type).toBe('checkbox');
		expect(input.checked).toBe(true);
		expect(input.id).toBe('visibility-checkbox');
		expect(input.disabled).toBe(false);
		expect(input.classList.contains('visibility-control')).toBe(true);
		expect(input.closest('label')?.textContent).toContain('Hidden from viewers');

		await fireEvent.click(input);
		expect(onchange).toHaveBeenCalledOnce();
	});

	it('connects invalid state and validation messages accessibly', () => {
		render(CheckboxInput, {
			label: 'Confirm visibility',
			isInvalid: true,
			invalidMessage: 'Choose whether this creature is hidden.',
			hasWarning: true,
			warningMessage: 'Players will not see this.',
			['aria-describedby']: 'visibility-help'
		});

		const input = screen.getByRole('checkbox', { name: 'Confirm visibility' }) as HTMLInputElement;
		const message = screen.getByRole('alert');
		const warning = screen.getByRole('status');
		const messageArea = input
			.closest('.form-field-messages')
			?.querySelector('.form-control-message-area');
		expect(message.textContent).toBe('Choose whether this creature is hidden.');
		expect(warning.textContent).toBe('Players will not see this.');
		expect(messageArea?.querySelectorAll('[role="alert"], [role="status"]')).toHaveLength(2);
		expect(input.getAttribute('aria-invalid')).toBe('true');
		expect(input.getAttribute('aria-describedby')).toBe(
			`visibility-help ${message.id} ${warning.id}`
		);
	});

	it('connects warning messages accessibly', () => {
		render(CheckboxInput, {
			label: 'Hidden',
			hasWarning: true,
			warningMessage: 'Players will not see this.',
			['aria-describedby']: 'help'
		});

		const input = screen.getByRole('checkbox', { name: 'Hidden' });
		const warning = screen.getByRole('status');
		expect(warning.textContent).toBe('Players will not see this.');
		expect(input.getAttribute('aria-describedby')).toBe(`help ${warning.id}`);
	});
});
