import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ActionButton from './ActionButton.svelte';

afterEach(() => {
	cleanup();
});

const label = createRawSnippet(() => ({ render: () => '<span>Save</span>' }));

describe('ActionButton', () => {
	it('renders its children as a non-submitting button by default', () => {
		render(ActionButton, { children: label });

		const button = screen.getByRole('button', { name: 'Save' });
		expect(button.getAttribute('type')).toBe('button');
		expect(button.classList.contains('ui-button--primary')).toBe(true);
	});

	it('applies the requested variant and extra classes', () => {
		render(ActionButton, { variant: 'danger', class: 'extra', children: label });

		const button = screen.getByRole('button', { name: 'Save' });
		expect(button.classList.contains('ui-button--danger')).toBe(true);
		expect(button.classList.contains('extra')).toBe(true);
	});

	it('calls onclick when clicked', async () => {
		const onclick = vi.fn();
		render(ActionButton, { onclick, children: label });

		await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(onclick).toHaveBeenCalledOnce();
	});

	it('can be disabled', () => {
		// eslint-disable-next-line @typescript-eslint/naming-convention -- native attribute name
		render(ActionButton, { disabled: true, children: label });

		expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
	});

	it('passes through aria attributes', () => {
		/* eslint-disable @typescript-eslint/naming-convention -- native attribute names */
		render(ActionButton, { 'aria-label': 'Remove thing', 'aria-pressed': true, children: label });
		/* eslint-enable @typescript-eslint/naming-convention */

		const button = screen.getByRole('button', { name: 'Remove thing' });
		expect(button.getAttribute('aria-pressed')).toBe('true');
	});

	it('shows warning and invalid messages accessibly', () => {
		render(ActionButton, {
			children: label,
			['aria-describedby']: 'help',
			hasWarning: true,
			warningMessage: 'Careful.',
			isInvalid: true,
			invalidMessage: 'Not allowed.'
		});

		const control = screen.getByRole('button', { name: 'Save' });
		const warning = screen.getByRole('status');
		const invalid = screen.getByRole('alert');
		expect(warning.textContent).toBe('Careful.');
		expect(invalid.textContent).toBe('Not allowed.');
		expect(control.getAttribute('aria-describedby')).toBe(`help ${invalid.id} ${warning.id}`);
	});

	it('renders no messages by default', () => {
		render(ActionButton, { children: label });

		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.queryByRole('status')).toBeNull();
	});
});
