import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import joinSessionPage from './+page.svelte';

const { mockedGoto, mockedResolve } = vi.hoisted(() => ({
	mockedGoto: vi.fn(),
	mockedResolve: vi.fn(
		(_route: string, params: { sessioncode: string }) => `/view/${params.sessioncode}`
	)
}));

vi.mock('$app/navigation', () => ({ goto: mockedGoto }));
vi.mock('$app/paths', () => ({ resolve: mockedResolve }));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.clearAllMocks();
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

		expect(screen.getByRole('alert').textContent).toBe('Enter an 8-character code.');
		expect(screen.queryByRole('status')).toBeNull();
	});

	it.each(['ABC2345Z', 'abc2345z', '  abc2345z  '])(
		'normalizes a valid code %j and navigates after the active session is found',
		async (code) => {
			const fetchMock = vi
				.fn<typeof fetch>()
				.mockResolvedValue(
					Response.json({ session: { id: 'session-id', viewerCode: 'ABC2345Z' } })
				);
			vi.stubGlobal('fetch', fetchMock);
			render(joinSessionPage);
			const input = screen.getByRole('textbox', { name: 'Session code' });
			await fireEvent.input(input, { target: { value: code } });
			await fireEvent.click(screen.getByRole('button', { name: 'Join session' }));

			await waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/view/ABC2345Z'));
			expect((input as HTMLInputElement).value).toBe('ABC2345Z');
			expect(fetchMock).toHaveBeenCalledWith(
				'/api/sessions/join',
				expect.objectContaining({
					method: 'POST',
					body: JSON.stringify({ viewerCode: 'ABC2345Z' })
				})
			);
			expect(mockedResolve).toHaveBeenCalledWith('/view/[sessioncode]', {
				sessioncode: 'ABC2345Z'
			});
			expect(screen.queryByRole('alert')).toBeNull();
		}
	);

	it('shows the inactive-session error without navigating', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn<typeof fetch>()
				.mockResolvedValue(
					Response.json({ message: 'No active session was found for this code.' }, { status: 404 })
				)
		);
		render(joinSessionPage);
		await fireEvent.input(screen.getByRole('textbox', { name: 'Session code' }), {
			target: { value: 'ABC2345Z' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Join session' }));

		expect((await screen.findByRole('alert')).textContent).toBe(
			'No active session was found for this code.'
		);
		expect(mockedGoto).not.toHaveBeenCalled();
	});

	it('shows a safe error when the join request cannot reach the server', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn<typeof fetch>().mockRejectedValue(new Error('Connection refused.'))
		);
		render(joinSessionPage);
		await fireEvent.input(screen.getByRole('textbox', { name: 'Session code' }), {
			target: { value: 'ABC2345Z' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Join session' }));

		expect((await screen.findByRole('alert')).textContent).toBe(
			'Unable to join the live session. Check the code and try again.'
		);
		expect(mockedGoto).not.toHaveBeenCalled();
	});

	it('prevents duplicate submissions while the lookup is pending', async () => {
		let resolveFetch: (response: Response) => void = () => undefined;
		vi.stubGlobal(
			'fetch',
			vi.fn<typeof fetch>().mockReturnValue(
				new Promise((resolve) => {
					resolveFetch = resolve;
				})
			)
		);
		render(joinSessionPage);
		await fireEvent.input(screen.getByRole('textbox', { name: 'Session code' }), {
			target: { value: 'ABC2345Z' }
		});
		const joinButton = screen.getByRole('button', { name: 'Join session' });
		const sessionCodeInput = screen.getByRole('textbox', { name: 'Session code' });
		await fireEvent.click(joinButton);

		expect(joinButton.hasAttribute('disabled')).toBe(true);
		expect(sessionCodeInput.hasAttribute('disabled')).toBe(true);
		expect(screen.getByRole('status').textContent).toBe('Joining live session...');
		resolveFetch(Response.json({ session: { id: 'session-id', viewerCode: 'ABC2345Z' } }));
		await waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/view/ABC2345Z'));
	});

	it('handles form submission without the default navigation', async () => {
		render(joinSessionPage);
		const input = screen.getByRole('textbox', { name: 'Session code' });
		await fireEvent.input(input, { target: { value: 'ABC2345Z' } });
		const form = input.closest('form');
		if (!form) throw new Error('Expected the session-code input to be in a form.');

		const isDefaultAllowed = await fireEvent.submit(form);

		expect(isDefaultAllowed).toBe(false);
		expect(screen.queryByRole('alert')).toBeNull();
		expect(mockedGoto).not.toHaveBeenCalled();
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

	it('clears a stale join error when the code is edited', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn<typeof fetch>()
				.mockResolvedValue(
					Response.json({ message: 'No active session was found for this code.' }, { status: 404 })
				)
		);
		render(joinSessionPage);
		const input = screen.getByRole('textbox', { name: 'Session code' });
		await fireEvent.input(input, { target: { value: 'ABC2345Z' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Join session' }));
		expect(await screen.findByRole('alert')).toBeTruthy();

		await fireEvent.input(input, { target: { value: 'ABC2345Y' } });

		expect(screen.queryByRole('alert')).toBeNull();
	});
});
