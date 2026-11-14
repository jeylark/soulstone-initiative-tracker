import { cleanup, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Card from './Card.svelte';

afterEach(() => {
	cleanup();
});

const children = createRawSnippet(() => ({ render: () => '<p>Card content</p>' }));

describe('Card', () => {
	it('renders its title and children with the requested heading level', () => {
		render(Card, { title: 'Card title', headingLevel: 'h3', children });

		expect(screen.getByRole('heading', { level: 3, name: 'Card title' })).toBeTruthy();
		expect(screen.getByText('Card content')).toBeTruthy();
	});

	it.each([
		{ variant: 'surface', spacing: 'standard' },
		{ variant: 'surface', spacing: 'compact' },
		{ variant: 'subtle', spacing: 'standard' },
		{ variant: 'subtle', spacing: 'compact' },
		{ variant: 'inset', spacing: 'standard' },
		{ variant: 'inset', spacing: 'compact' }
	] as const)(
		'applies the $variant variant and $spacing spacing classes',
		({ variant, spacing }) => {
			render(Card, { title: 'Card title', variant, spacing, children });

			const heading = screen.getByRole('heading', { name: 'Card title' });
			expect(heading.parentElement?.classList.contains(`card--${variant}`)).toBe(true);
			expect(heading.parentElement?.classList.contains(`card--${spacing}`)).toBe(true);
		}
	);

	it.each(['large', 'medium', 'small', 'compact'] as const)(
		'applies the %s header size class',
		(headerSize) => {
			render(Card, { title: 'Card title', headerSize, children });

			const heading = screen.getByRole('heading', { name: 'Card title' });
			expect(heading.classList.contains(`card-header--${headerSize}`)).toBe(true);
		}
	);

	it('passes a caller class to the card container', () => {
		render(Card, { title: 'Card title', class: 'custom-card', children });

		const heading = screen.getByRole('heading', { name: 'Card title' });
		expect(heading.parentElement?.classList.contains('custom-card')).toBe(true);
	});

	it('owns layout and accent presentation on the card container', () => {
		render(Card, {
			title: 'Card title',
			isFullHeight: true,
			hasOverlayAction: true,
			isAccented: true,
			accentColor: '#1f5fbf',
			isMuted: true,
			isContentSized: true,
			isStripItem: true,
			children
		});

		const card = screen.getByRole('heading', { name: 'Card title' }).parentElement;
		expect(card?.classList.contains('card--full-height')).toBe(true);
		expect(card?.classList.contains('card--overlay-action')).toBe(true);
		expect(card?.classList.contains('card--accented')).toBe(true);
		expect(card?.classList.contains('card--muted')).toBe(true);
		expect(card?.classList.contains('card--content-sized')).toBe(true);
		expect(card?.classList.contains('card--strip-item')).toBe(true);
		expect(card?.style.getPropertyValue('--card-accent-color')).toBe('#1f5fbf');
	});
});
