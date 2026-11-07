import { cleanup, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ViewPage from './ViewPage.svelte';

afterEach(() => {
	cleanup();
});

const children = createRawSnippet(() => ({ render: () => '<p>View content</p>' }));

describe('ViewPage', () => {
	it('renders the title, children, and shared document title', () => {
		render(ViewPage, { title: 'Saved challenges', children });

		expect(screen.getByRole('heading', { level: 1, name: 'Saved challenges' })).toBeTruthy();
		expect(screen.getByText('View content')).toBeTruthy();
		expect(document.title).toBe('Saved challenges | Soulstone Initiative Tracker');
	});
});
