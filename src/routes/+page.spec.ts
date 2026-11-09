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
		expect(within(actions).getAllByRole('listitem')).toHaveLength(2);
	});

	it('sets the page title and description', () => {
		render(LandingPage);

		expect(document.title).toBe('Soulstone Initiative Tracker');
		expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
			'Manage your own challenge or watch a running challenge.'
		);
	});

	it('links the available actions to their views', () => {
		render(LandingPage);

		const links = [
			{ name: 'Host Manage your own challenge', href: '/challenges' },
			{ name: 'Join Watch a running challenge', href: '/view' }
		];
		for (const { name, href } of links) {
			expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
		}
	});
});
