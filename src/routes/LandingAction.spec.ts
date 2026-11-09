import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { resolve } from '$app/paths';
import LandingAction from './LandingAction.svelte';

afterEach(() => {
	cleanup();
});

describe('LandingAction', () => {
	it('renders its title and description as the accessible link name', () => {
		render(LandingAction, {
			href: resolve('/challenges'),
			title: 'Host',
			description: 'Manage your own challenge'
		});

		const link = screen.getByRole('link', { name: 'Host Manage your own challenge' });
		expect(link.getAttribute('href')).toBe('/challenges');
		expect(link.textContent).toContain('Manage your own challenge');
	});
});
