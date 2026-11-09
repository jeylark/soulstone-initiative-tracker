import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import viewerSessionPage from './+page.svelte';

const { mockedPage } = vi.hoisted(() => ({
	mockedPage: { params: {} as Record<string, string> }
}));

vi.mock('$app/state', () => ({ page: mockedPage }));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

beforeEach(() => {
	mockedPage.params = { sessioncode: 'ABC2345Z' };
});

describe('viewer session placeholder', () => {
	it('shows the session code and explains that the live view is not available yet', () => {
		render(viewerSessionPage);

		expect(screen.getByRole('heading', { level: 1, name: 'Live session' })).toBeTruthy();
		expect(screen.getByText('ABC2345Z', { selector: 'code' })).toBeTruthy();
		expect(screen.getByRole('status').textContent).toBe(
			'The live session view is not available yet.'
		);
		expect(document.title).toBe('Live session | Soulstone Initiative Tracker');
	});
});
