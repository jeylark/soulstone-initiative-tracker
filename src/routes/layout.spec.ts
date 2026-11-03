import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Layout from './+layout.svelte';
import LandingPage from './+page.svelte';
import SavedChallengesPage from './challenges/+page.svelte';
import NewChallengePage from './challenges/new/+page.svelte';
import JoinSessionPage from './join/+page.svelte';

afterEach(() => {
	cleanup();
});

const views = [
	{ name: 'landing', page: LandingPage },
	{ name: 'new challenge', page: NewChallengePage },
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

	it.each(views)('does not duplicate the shell in the $name page', ({ page }) => {
		const { container } = render(page);

		expect(container.querySelector('header')).toBeNull();
		expect(container.querySelector('footer')).toBeNull();
		expect(container.querySelectorAll('main')).toHaveLength(0);
	});
});
