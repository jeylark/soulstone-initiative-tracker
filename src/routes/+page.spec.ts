import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import LandingPage from './+page.svelte';

afterEach(() => {
	cleanup();
});

describe('landing page', () => {
	it('shows the heading and a named list of available actions', () => {
		render(LandingPage);

		expect(screen.getByRole('heading', { level: 1, name: 'Initiative Tracker' })).toBeTruthy();
		const actions = screen.getByRole('list', { name: 'Available actions' });
		expect(within(actions).getAllByRole('listitem')).toHaveLength(3);
	});

	it('sets the page title and description', () => {
		render(LandingPage);

		expect(document.title).toBe('Soulstone Initiative Tracker');
		expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
			'Create a challenge, open a saved challenge, or join a live session.'
		);
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
