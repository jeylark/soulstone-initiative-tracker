import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ErrorDisplay from './ErrorDisplay.svelte';

afterEach(() => {
	cleanup();
});

describe('ErrorDisplay', () => {
	it('shows the message and lets the user reveal and hide error details', async () => {
		const message = 'The new challenge could not be saved.';
		const details = 'ChallengeLibraryStorageError: IndexedDB is not available.';
		render(ErrorDisplay, { message, details });

		expect(screen.getByRole('alert').textContent).toContain(message);
		expect(screen.getByText(details).hasAttribute('hidden')).toBe(true);

		const displayButton = screen.getByRole('button', { name: 'Display error details' });
		expect(displayButton.getAttribute('aria-expanded')).toBe('false');

		await fireEvent.click(displayButton);

		expect(screen.getByText(details)).toBeTruthy();
		const hideButton = screen.getByRole('button', { name: 'Hide error details' });
		expect(hideButton.getAttribute('aria-expanded')).toBe('true');

		await fireEvent.click(hideButton);

		expect(screen.getByText(details).hasAttribute('hidden')).toBe(true);
		expect(
			screen.getByRole('button', { name: 'Display error details' }).getAttribute('aria-expanded')
		).toBe('false');
	});
});
