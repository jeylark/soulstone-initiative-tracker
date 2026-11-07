import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import savedChallengesPage from './+page.svelte';

afterEach(() => {
	cleanup();
});

describe('saved challenges view', () => {
	it('has a heading and a link back to the landing page', async () => {
		render(savedChallengesPage);

		expect(await screen.findByRole('heading', { level: 1, name: 'Saved challenges' })).toBeTruthy();
		expect(document.title).toBe('Saved challenges | Soulstone Initiative Tracker');
	});
});
