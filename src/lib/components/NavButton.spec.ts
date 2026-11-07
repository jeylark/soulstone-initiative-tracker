import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NavButton from './NavButton.svelte';

afterEach(() => {
	cleanup();
});

const label = createRawSnippet(() => ({ render: () => '<span>Go</span>' }));

describe('NavButton', () => {
	it('renders a link styled like an ActionButton', () => {
		render(NavButton, { href: '/next', children: label });

		const link = screen.getByRole('link', { name: 'Go' });
		expect(link.getAttribute('href')).toBe('/next');
		expect(link.classList.contains('ui-button')).toBe(true);
		expect(link.classList.contains('ui-button--primary')).toBe(true);
	});

	it('applies the requested variant and extra classes', () => {
		render(NavButton, { href: '/x', variant: 'neutral', class: 'extra', children: label });

		const link = screen.getByRole('link', { name: 'Go' });
		expect(link.classList.contains('ui-button--neutral')).toBe(true);
		expect(link.classList.contains('extra')).toBe(true);
	});

	it('calls onclick when clicked', async () => {
		const onclick = vi.fn((event: Readonly<Event>) => event.preventDefault());
		render(NavButton, { href: '/x', onclick, children: label });

		await fireEvent.click(screen.getByRole('link', { name: 'Go' }));

		expect(onclick).toHaveBeenCalledOnce();
	});

	it('is not navigable or clickable when disabled', async () => {
		const onclick = vi.fn();
		render(NavButton, { href: '/x', isDisabled: true, onclick, children: label });

		const link = screen.getByRole('link', { name: 'Go' });
		expect(link.getAttribute('aria-disabled')).toBe('true');
		expect(link.hasAttribute('href')).toBe(false);
		expect(link.getAttribute('tabindex')).toBe('-1');

		await fireEvent.click(link);
		expect(onclick).not.toHaveBeenCalled();
	});
});
