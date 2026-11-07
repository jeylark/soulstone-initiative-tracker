import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { resolve } from '$app/paths';
import LandingAction from './LandingAction.svelte';

afterEach(() => {
	cleanup();
});

describe('LandingAction', () => {
	it('renders its label as the accessible link name and uses its destination', () => {
		render(LandingAction, { href: resolve('/challenges/new'), label: 'New challenge' });

		const link = screen.getByRole('link', { name: 'New challenge' });
		expect(link.getAttribute('href')).toBe('/challenges/new');
	});
});
