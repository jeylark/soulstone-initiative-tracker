import { cleanup, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTurnDisplayLookup, createTurnOrderDisplay } from '#lib/challenge';
import { createRunChallenge } from '../../challenges/[challengeId]/run/run-test-support';
import viewerSessionPage from './+page.svelte';

const { mockedPage } = vi.hoisted(() => ({
	mockedPage: { params: {} as Record<string, string> }
}));

const eventSources: MockEventSource[] = [];

class MockEventSource extends EventTarget {
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSED = 2;
	readonly url: string;
	isClosed = false;

	constructor(url: string) {
		super();
		this.url = url;
		eventSources.push(this);
	}

	close(): void {
		this.isClosed = true;
	}
}

vi.mock('$app/state', () => ({ page: mockedPage }));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	eventSources.length = 0;
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
					challengeName: 'Ashen Company',
					turnOrder
				})
			)
		);
		vi.stubGlobal('EventSource', MockEventSource);
		render(viewerSessionPage);

		const order = await screen.findByRole('list', { name: 'Generated turn order' });
		expect(screen.getByRole('heading', { level: 1, name: 'Ashen Company' })).toBeTruthy();
		expect(document.title).toBe('Ashen Company | Soulstone Initiative Tracker');
		const entries = within(order).getAllByRole('listitem');
		expect(entries.map((entry) => entry.querySelector('h2')?.textContent)).toEqual([
			'Players',
			'Players',
			undefined
		]);
		expect(
			entries.map((entry) => entry.querySelector('.turn-order-creature-name')?.textContent ?? null)
		).toEqual(['Aria', 'Rook', 'Spawn']);
		expect(screen.queryByRole('checkbox')).toBeNull();
		expect(screen.queryByRole('status')).toBeNull();

		await waitFor(() => expect(eventSources).toHaveLength(1));
		expect(eventSources[0]?.url).toBe('/api/sessions/session-id/events');
		const updatedTurnOrder = turnOrder.map((item, index) =>
			index === 0 && item.kind === 'turn'
				? { ...item, display: { ...item.display, label: 'Updated Aria' } }
				: item
		);
		eventSources[0]?.dispatchEvent(
			new MessageEvent('turn-order', {
				data: JSON.stringify({
					challengeName: 'Updated Ashen Company',
					turnOrder: updatedTurnOrder
				})
			})
		);
		expect(await screen.findByText('Updated Aria')).toBeTruthy();
		expect(screen.getByRole('heading', { level: 1, name: 'Updated Ashen Company' })).toBeTruthy();
	});

	it('shows when a live session ends and closes the event stream on unmount', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn<typeof fetch>().mockResolvedValue(
				Response.json({
					session: { id: 'session-id', viewerCode: 'A234' },
					challengeName: 'Ashen Company',
					turnOrder: []
				})
			)
		);
		vi.stubGlobal('EventSource', MockEventSource);
		const { unmount } = render(viewerSessionPage);

		await waitFor(() => expect(eventSources).toHaveLength(1));
		eventSources[0]?.dispatchEvent(new MessageEvent('session-ended'));

		expect(await screen.findByText('This live session has ended.')).toBeTruthy();
		expect(eventSources[0]?.isClosed).toBe(true);
		unmount();
	});

	it('explains when a session has no generated turn order', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn<typeof fetch>().mockResolvedValue(
				Response.json({
					session: { id: 'session-id', viewerCode: 'A234' },
					challengeName: 'Ashen Company',
					turnOrder: []
				})
			)
		);
		vi.stubGlobal('EventSource', MockEventSource);
		render(viewerSessionPage);

		expect(await screen.findByText('The active session has no generated turn order.')).toBeTruthy();
	});

	it.each([{ turnOrder: [] }, { turnOrder: [{ kind: 'spawn' }] }])(
		'shows a terminal viewer-limit message and closes the stream with $turnOrder',
		async ({ turnOrder }) => {
			vi.stubGlobal(
				'fetch',
				vi.fn<typeof fetch>().mockResolvedValue(
					Response.json({
						session: { id: 'session-id', viewerCode: 'A234' },
						challengeName: 'Ashen Company',
						turnOrder
					})
				)
			);
			vi.stubGlobal('EventSource', MockEventSource);
			render(viewerSessionPage);
			await waitFor(() => expect(eventSources).toHaveLength(1));

			eventSources[0]?.dispatchEvent(new MessageEvent('viewer-limit', { data: '{}' }));

			expect((await screen.findByRole('alert')).textContent).toBe(
				'This live session has reached its viewer connection limit. Try again later.'
			);
			expect(eventSources[0]?.isClosed).toBe(true);
			expect(screen.queryByText('Connection lost. Reconnecting...')).toBeNull();
			expect(screen.queryByRole('list')).toBeNull();
		}
	);

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
