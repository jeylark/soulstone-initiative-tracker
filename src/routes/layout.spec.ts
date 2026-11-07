import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import type { Component } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Layout from './+layout.svelte';
import LandingPage from './+page.svelte';
import SavedChallengesPage from './challenges/+page.svelte';
import RollChallengePage from './challenges/[challengeId]/roll/+page.svelte';
import ChallengeSetupPage from './challenges/[challengeId]/setup/+page.svelte';
import NewChallengePage from './challenges/new/+page.svelte';
import JoinSessionPage from './join/+page.svelte';

vi.mock('$app/state', () => ({
	page: {
		params: { challengeId: '00000000-0000-4000-8000-000000000001' }
	}
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

afterEach(() => {
	cleanup();
});

const views: { name: string; page: Component }[] = [
	{ name: 'landing', page: LandingPage },
	{ name: 'new challenge', page: NewChallengePage },
	{ name: 'challenge setup', page: ChallengeSetupPage },
	{ name: 'running challenge', page: RollChallengePage },
	{ name: 'saved challenges', page: SavedChallengesPage },
	{ name: 'join session', page: JoinSessionPage }
];

const renderLayout = () =>
	render(Layout, {
		params: {},
		data: {},
		children: createRawSnippet(() => ({ render: () => '<p>content</p>' }))
	});

describe('app layout', () => {
	it('toggles between light and dark themes', async () => {
		const { container } = renderLayout();

		const darkModeButton = screen.getByRole('button', { name: 'Dark mode' });
		expect(darkModeButton.getAttribute('aria-pressed')).toBe('false');

		await fireEvent.click(darkModeButton);

		const lightModeButton = screen.getByRole('button', { name: 'Light mode' });
		expect(lightModeButton.getAttribute('aria-pressed')).toBe('true');
		expect(container.querySelector('.app-shell')?.classList.contains('theme-dark')).toBe(true);

		await fireEvent.click(lightModeButton);

		expect(screen.getByRole('button', { name: 'Dark mode' }).getAttribute('aria-pressed')).toBe(
			'false'
		);
		expect(container.querySelector('.app-shell')?.classList.contains('theme-dark')).toBe(false);
	});

	it('shows the app header and renders page content', () => {
		const { container } = renderLayout();

		expect(container.querySelector('header')?.textContent).toContain('Soulstone');
		expect(screen.getByText('content')).toBeTruthy();
	});

	it('links the header icon and app name to the landing page and has no navigation bar', () => {
		const { container } = renderLayout();
		const header = container.querySelector('header');
		expect(header).not.toBeNull();
		if (!header) return;

		expect(within(header).getByRole('button', { name: 'Dark mode' })).toBeTruthy();
		const homeLink = within(header).getByRole('link', { name: 'Soulstone' });
		expect(homeLink.getAttribute('href')).toBe('/');
		expect(homeLink.querySelector('img')).not.toBeNull();
		expect(screen.queryByRole('navigation')).toBeNull();
	});

	it.each(views)('does not duplicate the shell in the $name page', ({ page }) => {
		const { container } = render(page);

		expect(container.querySelector('header')).toBeNull();
		expect(container.querySelector('footer')).toBeNull();
		expect(container.querySelectorAll('main')).toHaveLength(0);
	});
});
