import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import joinSessionPage from './+page.svelte';

afterEach(() => {
	cleanup();
});

describe('join session view', () => {
	it('has a heading and a link back to the landing page', async () => {
		render(joinSessionPage);

		expect(
			await screen.findByRole('heading', { level: 1, name: 'Join a live session' })
		).toBeTruthy();
	});
});
