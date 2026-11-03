import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import LandingPage from './+page.svelte';

afterEach(() => {
	cleanup();
});

describe('landing page', () => {
	it('toggles between light and dark themes', async () => {
		const { container } = render(LandingPage);

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

	it('links the available actions to their views', () => {
		render(LandingPage);

		const links = [
			{ name: 'New challenge', href: '/challenges/new' },
			{ name: 'Open saved challenge', href: '/challenges' },
			{ name: 'Join a live session', href: '/join' }
		];
		for (const { name, href } of links) {
			expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
		}
	});
});
