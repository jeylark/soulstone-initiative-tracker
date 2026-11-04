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
		expect(button.classList.contains('action-button--primary')).toBe(true);
	});

	it('applies the requested variant and extra classes', () => {
		render(ActionButton, { variant: 'danger', class: 'extra', children: label });

		const button = screen.getByRole('button', { name: 'Save' });
		expect(button.classList.contains('action-button--danger')).toBe(true);
		expect(button.classList.contains('extra')).toBe(true);
	});

	it('calls onclick when clicked', async () => {
		const onclick = vi.fn();
		render(ActionButton, { onclick, children: label });

		await fireEvent.click(screen.getByRole('button', { name: 'Save' }));

		expect(onclick).toHaveBeenCalledOnce();
	});

	it('can be disabled', () => {
		render(ActionButton, { disabled: true, children: label });

		expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
	});

	it('passes through aria attributes', () => {
		render(ActionButton, { 'aria-label': 'Remove thing', 'aria-pressed': true, children: label });

		const button = screen.getByRole('button', { name: 'Remove thing' });
		expect(button.getAttribute('aria-pressed')).toBe('true');
	});
});
