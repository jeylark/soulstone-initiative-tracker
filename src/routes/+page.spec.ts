import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import LandingPage from './+page.svelte';

afterEach(() => {
	cleanup();
});

describe('landing page', () => {
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
