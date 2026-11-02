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

	it('shows the available actions as buttons', () => {
		render(LandingPage);

		expect(screen.getByRole('button', { name: 'New challenge' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Open saved challenge' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Join a live session' })).toBeTruthy();
	});
});
