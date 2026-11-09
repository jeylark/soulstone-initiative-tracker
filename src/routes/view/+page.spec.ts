import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import joinSessionPage from './+page.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe('viewer entry page', () => {
	it('renders a labeled session-code field and a join submit button', () => {
		render(joinSessionPage);

		expect(screen.getByRole('heading', { level: 1, name: 'Join a live session' })).toBeTruthy();
		expect(document.title).toBe('Join a live session | Soulstone Initiative Tracker');
		const input = screen.getByRole('textbox', { name: 'Session code' });
		expect(input.getAttribute('autocomplete')).toBe('off');
		expect(input.getAttribute('spellcheck')).toBe('false');
		expect(input.hasAttribute('maxlength')).toBe(false);
		expect(screen.getByRole('button', { name: 'Join session' }).getAttribute('type')).toBe(
			'submit'
		);
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.queryByRole('status')).toBeNull();
	});

	it.each(['', '   '])('rejects an empty code %j with an associated error', async (code) => {
		render(joinSessionPage);
		const input = screen.getByRole('textbox', { name: 'Session code' });
		await fireEvent.input(input, { target: { value: code } });
		await fireEvent.click(screen.getByRole('button', { name: 'Join session' }));

		const alert = screen.getByRole('alert');
		expect(alert.textContent).toBe('Enter a session code.');
		expect(input.getAttribute('aria-invalid')).toBe('true');
		expect(input.getAttribute('aria-describedby')).toBe(alert.id);
		expect(screen.queryByRole('status')).toBeNull();
	});

	it.each([
		'ABC2345',
		'ABC234567',
		'ABC2345!',
		'ABC 2345',
		'ABC23450',
		'ABC23451',
		'ABC2345I',
		'ABC2345O'
	])('rejects a malformed code %j', async (code) => {
		render(joinSessionPage);
		await fireEvent.input(screen.getByRole('textbox', { name: 'Session code' }), {
			target: { value: code }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Join session' }));

		expect(screen.getByRole('alert').textContent).toBe(
			'Enter an 8-character code using letters A-Z (except I and O) and numbers 2-9.'
		);
		expect(screen.queryByRole('status')).toBeNull();
	});

	it.each(['ABC2345Z', 'abc2345z', '  abc2345z  '])(
		'normalizes a valid code %j and reports that joining is unavailable without a request',
		async (code) => {
			const fetchSpy = vi.spyOn(globalThis, 'fetch');
			render(joinSessionPage);
			const input = screen.getByRole('textbox', { name: 'Session code' });
			await fireEvent.input(input, { target: { value: code } });
			await fireEvent.click(screen.getByRole('button', { name: 'Join session' }));

			expect((input as HTMLInputElement).value).toBe('ABC2345Z');
			expect(screen.getByRole('status').textContent).toBe(
				'Joining live sessions is not available yet.'
			);
			expect(screen.queryByRole('alert')).toBeNull();
			expect(fetchSpy).not.toHaveBeenCalled();
		}
	);

	it('handles form submission without the default navigation', async () => {
		render(joinSessionPage);
		const input = screen.getByRole('textbox', { name: 'Session code' });
		await fireEvent.input(input, { target: { value: 'ABC2345Z' } });
		const form = input.closest('form');
		if (!form) throw new Error('Expected the session-code input to be in a form.');

		const isDefaultAllowed = await fireEvent.submit(form);

		expect(isDefaultAllowed).toBe(false);
		expect(screen.getByRole('status').textContent).toBe(
			'Joining live sessions is not available yet.'
		);
	});

	it('clears a stale validation error when the code is edited', async () => {
		render(joinSessionPage);
		await fireEvent.click(screen.getByRole('button', { name: 'Join session' }));
		expect(screen.getByRole('alert')).toBeTruthy();
		const input = screen.getByRole('textbox', { name: 'Session code' });

		await fireEvent.input(input, { target: { value: 'a' } });

		expect(screen.queryByRole('alert')).toBeNull();
		expect(input.getAttribute('aria-invalid')).not.toBe('true');
		expect(input.hasAttribute('aria-describedby')).toBe(false);
		expect((input as HTMLInputElement).value).toBe('a');
	});

	it('clears the unavailable status when the code is edited', async () => {
		render(joinSessionPage);
		const input = screen.getByRole('textbox', { name: 'Session code' });
		await fireEvent.input(input, { target: { value: 'ABC2345Z' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Join session' }));
		expect(screen.getByRole('status')).toBeTruthy();

		await fireEvent.input(input, { target: { value: 'ABC2345Y' } });

		expect(screen.queryByRole('status')).toBeNull();
		expect(screen.queryByRole('alert')).toBeNull();
	});
});
