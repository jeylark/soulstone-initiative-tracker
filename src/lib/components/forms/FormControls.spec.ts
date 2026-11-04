import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NumberInput from './NumberInput.svelte';
import RangeInput from './RangeInput.svelte';
import SelectInput from './SelectInput.svelte';
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
});

describe('NumberInput', () => {
	it('preserves numeric constraints and forwards input events', async () => {
		const oninput = vi.fn();
		render(NumberInput, {
			label: 'Initiative stat',
			value: 2,
			min: 1,
			step: 1,
			oninput
		});

		const input = screen.getByRole('spinbutton', { name: 'Initiative stat' }) as HTMLInputElement;
		expect(input.type).toBe('number');
		expect(input.value).toBe('2');
		expect(input.min).toBe('1');
		expect(input.step).toBe('1');
		expect(input.closest('label')?.textContent).toContain('Initiative stat');

		await fireEvent.input(input, { target: { value: '4' } });
		expect(oninput).toHaveBeenCalledOnce();
	});
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
