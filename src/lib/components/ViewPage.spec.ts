import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ViewPage from './ViewPage.svelte';

afterEach(() => {
	cleanup();
});

const children = createRawSnippet(() => ({ render: () => '<p>View content</p>' }));
const actions = createRawSnippet(() => ({ render: () => '<button>Title action</button>' }));

describe('ViewPage', () => {
	it('uses 16px of bottom padding below the page content', () => {
		const { container } = render(ViewPage, { title: 'Saved challenges', children });

		expect(container.querySelector('section')).not.toBeNull();
		const source = readFileSync('src/lib/components/ViewPage.svelte', 'utf8');
		expect(source).toMatch(/section\s*\{[^}]*padding-block:\s*24px\s+16px\s*;/s);
	});

	it('renders the title, children, and shared document title', () => {
		render(ViewPage, { title: 'Saved challenges', children });

		expect(screen.getByRole('heading', { level: 1, name: 'Saved challenges' })).toBeTruthy();
		expect(screen.getByText('View content')).toBeTruthy();
		expect(document.title).toBe('Saved challenges | Soulstone Initiative Tracker');
	});

	it('renders optional actions alongside the page title', () => {
		render(ViewPage, { title: 'Saved challenges', children, actions });

		const heading = screen.getByRole('heading', { level: 1, name: 'Saved challenges' });
		const action = screen.getByRole('button', { name: 'Title action' });
		expect(action.closest('.view-page-heading')).toBe(heading.closest('.view-page-heading'));
	});
});
