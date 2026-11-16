import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Card from './Card.svelte';

afterEach(() => {
	cleanup();
});

const children = createRawSnippet(() => ({ render: () => '<p>Card content</p>' }));

describe('Card', () => {
	it.each([
		{ insets: {}, expectedTop: '0px', expectedBottom: '0px' },
		{ insets: { scrollbarInsetTop: 32 }, expectedTop: '32px', expectedBottom: '0px' },
		{ insets: { scrollbarInsetBottom: 24 }, expectedTop: '0px', expectedBottom: '24px' },
		{
			insets: { scrollbarInsetTop: 32, scrollbarInsetBottom: 24 },
			expectedTop: '32px',
			expectedBottom: '24px'
		},
		{
			insets: { scrollbarInsetTop: -10, scrollbarInsetBottom: -20 },
			expectedTop: '0px',
			expectedBottom: '0px'
		}
	])(
		'sets independent scrollbar insets to $expectedTop and $expectedBottom',
		({ insets, expectedTop, expectedBottom }) => {
			render(Card, { title: 'Card title', children, ...insets });
			const body = screen.getByRole('region', { name: 'Card title' });
			expect(body.style.getPropertyValue('--card-scrollbar-inset-top')).toBe(expectedTop);
			expect(body.style.getPropertyValue('--card-scrollbar-inset-bottom')).toBe(expectedBottom);
		}
	);

	it('updates scrollbar clearance when its props change', async () => {
		const { rerender } = render(Card, {
			title: 'Card title',
			children,
			scrollbarInsetTop: 32,
			scrollbarInsetBottom: 0
		});
		const body = screen.getByRole('region', { name: 'Card title' });
		expect(body.style.getPropertyValue('--card-scrollbar-inset-top')).toBe('32px');
		await rerender({ scrollbarInsetTop: 0, scrollbarInsetBottom: 16 });
		expect(body.style.getPropertyValue('--card-scrollbar-inset-top')).toBe('0px');
		expect(body.style.getPropertyValue('--card-scrollbar-inset-bottom')).toBe('16px');
	});

	it('reserves clearance outside the scrollport rather than inside its content', () => {
		render(Card, { title: 'Card title', children });
		expect(screen.getByRole('region', { name: 'Card title' }).classList.contains('card-body')).toBe(
			true
		);
		const source = readFileSync('src/lib/components/Card.svelte', 'utf8');
		expect(source).toMatch(
			/\.card-body\s*\{[^}]*margin-block-start:\s*calc\(-12px\s*\+\s*var\(--card-scrollbar-inset-top\)\)/s
		);
		expect(source).toMatch(
			/\.card-body\s*\{[^}]*margin-block-end:\s*calc\(-12px\s*\+\s*var\(--card-scrollbar-inset-bottom\)\)/s
		);
	});

	it('keeps its title outside a named keyboard-accessible scrolling body by default', () => {
		render(Card, { title: 'Card title', children });

		const heading = screen.getByRole('heading', { name: 'Card title' });
		const body = screen.getByRole('region', { name: 'Card title' });
		expect(body.classList.contains('card-body')).toBe(true);
		expect(body.getAttribute('tabindex')).toBe('0');
		expect(body.getAttribute('aria-labelledby')).toBe(heading.id);
		expect(body.contains(screen.getByText('Card content'))).toBe(true);
		expect(body.contains(heading)).toBe(false);
		expect(body.parentElement).toBe(heading.parentElement);
		expect(heading.parentElement?.classList.contains('card--full-height')).toBe(false);
	});

	it('caps every card using the viewport and sticky offsets without clipping the title', () => {
		render(Card, { title: 'Card title', children });
		const card = screen.getByRole('heading', { name: 'Card title' }).parentElement;
		expect(card?.classList.contains('card')).toBe(true);
		const source = readFileSync('src/lib/components/Card.svelte', 'utf8');
		expect(source).toMatch(/\.card\s*\{[^}]*box-sizing:\s*border-box/s);
		expect(source).toMatch(/\.card\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/s);
		expect(source).toMatch(/--card-viewport-height:\s*100vh/);
		expect(source).toMatch(
			/@supports\s*\(height:\s*100dvh\)[\s\S]*--card-viewport-height:\s*100dvh/
		);
		expect(source).toMatch(
			/max-block-size:\s*max\(\s*0px,\s*calc\([\s\S]*?var\(--card-viewport-height\)\s*-\s*var\(--app-sticky-header-height,\s*0px\)\s*-\s*var\(--app-sticky-footer-height,\s*0px\)\s*-\s*12px/
		);
		expect(source).not.toMatch(/\.card\s*\{[^}]*overflow:\s*(?:auto|hidden)/s);
		expect(source).toMatch(/\.card-body\s*\{[^}]*min-block-size:\s*0[^}]*overflow:\s*auto/s);
		expect(source).toMatch(/\.card-body:focus-visible\s*\{[^}]*outline:/s);
	});

	it('gives cards with identical titles distinct accessible heading references', () => {
		render(Card, { title: 'Card title', children });
		render(Card, { title: 'Card title', children });
		const headings = screen.getAllByRole('heading', { name: 'Card title' });
		const bodies = screen.getAllByRole('region', { name: 'Card title' });
		expect(headings[0].id).not.toBe(headings[1].id);
		expect(bodies.map((body) => body.getAttribute('aria-labelledby'))).toEqual(
			headings.map((heading) => heading.id)
		);
	});

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
