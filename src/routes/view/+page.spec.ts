import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import joinSessionPage from './+page.svelte';

afterEach(() => {
	cleanup();
});

describe('viewer entry page', () => {
	it('uses the existing join-session placeholder at the new route', () => {
		render(joinSessionPage);

		expect(screen.getByRole('heading', { level: 1, name: 'Join a live session' })).toBeTruthy();
		expect(document.title).toBe('Join a live session | Soulstone Initiative Tracker');
		expect(screen.getByText('Joining live sessions is not available yet.')).toBeTruthy();
	});
});
