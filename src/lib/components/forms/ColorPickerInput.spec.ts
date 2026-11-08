import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ColorPickerInput from './ColorPickerInput.svelte';

afterEach(() => {
	cleanup();
});

describe('ColorPickerInput', () => {
	it('renders an accessible configurable palette and reports the selected color', async () => {
		const onchange = vi.fn();
		render(ColorPickerInput, {
			label: 'Faction color for Players',
			name: 'players-color',
			options: [
				{ value: 'blue', label: 'Blue', hex: '#5687c8' },
				{ value: 'red', label: 'Red', hex: '#c76a6e' }
			],
			value: 'blue',
			onchange
		});

		const group = screen.getByRole('group', { name: 'Faction color for Players' });
		const blue = within(group).getByRole('radio', { name: 'Blue' }) as HTMLInputElement;
		const red = within(group).getByRole('radio', { name: 'Red' }) as HTMLInputElement;
		expect(blue.checked).toBe(true);
		expect(red.checked).toBe(false);
		expect(blue.name).toBe('players-color');

		await fireEvent.click(red);
		expect(onchange).toHaveBeenCalledWith('red');
	});

	it('disables every color option when disabled', () => {
		render(ColorPickerInput, {
			label: 'Faction color',
			name: 'c',
			options: [
				{ value: 'blue', label: 'Blue', hex: '#5687c8' },
				{ value: 'red', label: 'Red', hex: '#c76a6e' }
			],
			value: 'blue',
			isDisabled: true,
			onchange: vi.fn()
		});

		for (const radio of screen.getAllByRole('radio')) {
			expect((radio as HTMLInputElement).matches(':disabled')).toBe(true);
		}
	});

	it('shows warning and invalid messages on the group', () => {
		render(ColorPickerInput, {
			label: 'Faction color',
			name: 'color',
			options: [{ value: 'blue', label: 'Blue', hex: '#5687c8' }],
			value: 'blue',
			hasWarning: true,
			warningMessage: 'Similar to another faction.',
			isInvalid: true,
			invalidMessage: 'Choose a color.',
			onchange: vi.fn()
		});

		const group = screen.getByRole('group', { name: 'Faction color' });
		const warning = screen.getByRole('status');
		const invalid = screen.getByRole('alert');
		const messageArea = group
			.closest('.form-field-messages')
			?.querySelector('.form-control-message-area');
		expect(warning.textContent).toBe('Similar to another faction.');
		expect(invalid.textContent).toBe('Choose a color.');
		expect(messageArea?.querySelectorAll('[role="alert"], [role="status"]')).toHaveLength(2);
		expect(group.getAttribute('aria-describedby')).toBe(`${invalid.id} ${warning.id}`);
	});
});
