import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTurnDisplayLookup, createTurnOrderDisplay } from '#lib/challenge';
import { createRunChallenge } from '../../challenges/[challengeId]/run/run-test-support';
import viewerSessionPage from './+page.svelte';

const { mockedPage } = vi.hoisted(() => ({
	mockedPage: { params: {} as Record<string, string> }
}));

vi.mock('$app/state', () => ({ page: mockedPage }));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

beforeEach(() => {
	mockedPage.params = { sessioncode: 'A234' };
});

describe('viewer session page', () => {
	it('shows the session code and a loading state while the turn order is requested', () => {
		vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockReturnValue(new Promise(() => undefined)));
		render(viewerSessionPage);

		expect(screen.getByRole('heading', { level: 1, name: 'Live session' })).toBeTruthy();
		expect(screen.getByText('A234', { selector: 'code' })).toBeTruthy();
		expect(screen.getByRole('status').textContent).toBe('Loading live session...');
		expect(document.title).toBe('Live session | Soulstone Initiative Tracker');
	});

	it('renders the active turn order and Spawn as a read-only list', async () => {
		const challenge = createRunChallenge();
		const turnOrder = createTurnOrderDisplay(
			challenge.runState!.generatedTurnOrder!,
			createTurnDisplayLookup(challenge),
			challenge.runState!.initiativeResults
		).items;
		vi.stubGlobal(
			'fetch',
			vi.fn<typeof fetch>().mockResolvedValue(
				Response.json({
					session: { id: 'session-id', viewerCode: 'A234' },
					turnOrder
				})
			)
		);
		render(viewerSessionPage);

		const order = await screen.findByRole('list', { name: 'Generated turn order' });
		const entries = within(order).getAllByRole('listitem');
		expect(entries.map((entry) => entry.querySelector('h2')?.textContent)).toEqual([
			'Players',
			'Players',
			'Spawn'
		]);
		expect(
			entries.map((entry) => entry.querySelector('.turn-order-creature-name')?.textContent ?? null)
		).toEqual(['Aria', 'Rook', null]);
		expect(screen.queryByRole('checkbox')).toBeNull();
		expect(screen.queryByRole('status')).toBeNull();
	});

	it('explains when a session has no generated turn order', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn<typeof fetch>()
				.mockResolvedValue(
					Response.json({ session: { id: 'session-id', viewerCode: 'A234' }, turnOrder: [] })
				)
		);
		render(viewerSessionPage);

		expect(await screen.findByText('The active session has no generated turn order.')).toBeTruthy();
	});

	it('shows an error when the viewer code no longer identifies an active session', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn<typeof fetch>()
				.mockResolvedValue(
					Response.json({ message: 'No active session was found for this code.' }, { status: 404 })
				)
		);
		render(viewerSessionPage);

		expect((await screen.findByRole('alert')).textContent).toBe(
			'No active session was found for this code.'
		);
	});
});
