import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CheckboxInput from './CheckboxInput.svelte';
import ColorPickerInput from './ColorPickerInput.svelte';
import NumberInput from './NumberInput.svelte';
import RangeInput from './RangeInput.svelte';
import SelectInput from './SelectInput.svelte';
import TextInput from './TextInput.svelte';

afterEach(() => {
	cleanup();
});

describe('CheckboxInput', () => {
	it('renders a labeled checkbox and forwards native attributes and change events', async () => {
		const onchange = vi.fn();
		render(CheckboxInput, {
			label: 'Hidden from viewers',
			checked: true,
			id: 'visibility-checkbox',
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
			['aria-describedby']: 'visibility-help'
		});

		const input = screen.getByRole('checkbox', { name: 'Confirm visibility' }) as HTMLInputElement;
		const message = screen.getByRole('alert');
		expect(message.textContent).toBe('Choose whether this creature is hidden.');
		expect(input.getAttribute('aria-invalid')).toBe('true');
		expect(input.getAttribute('aria-describedby')).toBe(`visibility-help ${message.id}`);
	});
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

	it('keeps message space reserved as validation messages change', () => {
		const { rerender } = render(NumberInput, {
			label: 'Initiative',
			value: '19',
			['aria-describedby']: 'initiative-help'
		});

		const input = screen.getByRole('spinbutton', { name: 'Initiative' }) as HTMLInputElement;
		const messageSlots = input.parentElement?.parentElement?.querySelectorAll(
			'.form-control-message-slot'
		);
		expect(messageSlots).toHaveLength(2);
		expect(input.value).toBe('19');
		expect(input.getAttribute('aria-describedby')).toBe('initiative-help');
		expect(screen.queryByRole('status')).toBeNull();
		expect(screen.queryByRole('alert')).toBeNull();

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
			input.parentElement?.parentElement?.querySelectorAll('.form-control-message-slot')
		).toHaveLength(2);
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
