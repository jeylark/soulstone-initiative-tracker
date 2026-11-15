import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SelectInput from './SelectInput.svelte';

afterEach(() => {
	cleanup();
});

describe('SelectInput', () => {
	it('uses shared wrapped-label row alignment', () => {
		render(SelectInput, {
			label: 'Faction',
			children: createRawSnippet(() => ({ render: () => '<option>Players</option>' }))
		});

		expect(document.querySelector('.form-field-messages--align-labels')).toBeTruthy();
	});

	it('renders child options and forwards selection changes and native attributes', async () => {
		const onchange = vi.fn();
		const children = createRawSnippet(() => ({
			render: () =>
				'<optgroup label="Factions"><option value="players">Players</option><option value="enemies">Enemies</option></optgroup>'
		}));
		render(SelectInput, {
			label: 'Faction',
			value: 'players',
			children,
			onchange
		});

		const select = screen.getByRole('combobox', { name: 'Faction' }) as HTMLSelectElement;
		expect(select.value).toBe('players');
		expect(select.closest('label')?.textContent).toContain('Faction');
		expect(within(select).getByRole('option', { name: 'Enemies' })).toBeTruthy();

		await fireEvent.change(select, { target: { value: 'enemies' } });
		expect(onchange).toHaveBeenCalledOnce();
		expect(select.value).toBe('enemies');
	});

	it('shows warning and invalid messages accessibly', () => {
		render(SelectInput, {
			label: 'Faction',
			children: createRawSnippet(() => ({ render: () => '<option>A</option>' })),
			['aria-describedby']: 'help',
			hasWarning: true,
			warningMessage: 'Careful.',
			isInvalid: true,
			invalidMessage: 'Not allowed.'
		});

		const control = screen.getByRole('combobox', { name: 'Faction' });
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
