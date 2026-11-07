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
});
