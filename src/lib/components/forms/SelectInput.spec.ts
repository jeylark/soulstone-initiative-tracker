import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SelectInput from './SelectInput.svelte';

afterEach(() => {
	cleanup();
});

describe('SelectInput', () => {
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
});
