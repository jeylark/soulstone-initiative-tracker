import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import turnOrderPage from '../RunPanel.svelte';
import { saveChallengeToLibrary, loadChallengeLibrary } from '#lib/challenge';
import { createSetupChallenge, expectPageError } from '../../../view-test-support';
import { ariaTurnId, rookTurnId, createRunChallenge } from './run-test-support';

const { mockedPage, mockedGoto } = vi.hoisted(() => ({
	mockedPage: { params: {} as Record<string, string> },
	mockedGoto: vi.fn()
}));

vi.mock('$app/state', () => ({ page: mockedPage }));
vi.mock('$app/navigation', () => ({ goto: mockedGoto }));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.clearAllMocks();
});

beforeEach(async () => {
	vi.stubGlobal('indexedDB', new IDBFactory());
	const challenge = createSetupChallenge();
	await saveChallengeToLibrary(challenge);
	mockedPage.params = { challengeId: challenge.id };
});

describe('turn-order run route', () => {
	it('restores a saved order and recalculates without changing initiative results', async () => {
		const challenge = createRunChallenge();
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);

		expect(await screen.findByRole('heading', { level: 1, name: 'Turn order' })).toBeTruthy();
		expect(await screen.findByText('Ashen Company')).toBeTruthy();
		expect(document.title).toBe('Turn order | Soulstone Initiative Tracker');
		const savedOrder = screen.getByRole('list', { name: 'Generated turn order' });
		expect(
			within(savedOrder)
				.getAllByRole('listitem')
				.map((item) => item.querySelector('h2')?.textContent)
		).toEqual(['Aria', 'Rook', 'Spawn']);
		expect(screen.queryByRole('link', { name: 'Return to roll' })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.generatedTurnOrder).toEqual([
				{ kind: 'turn', turnId: rookTurnId },
				{ kind: 'turn', turnId: ariaTurnId },
				{ kind: 'spawn' }
			]);
			expect(saved?.runState?.initiativeResults).toEqual(challenge.runState?.initiativeResults);
		});
		expect(mockedGoto).not.toHaveBeenCalled();
	});

	it('shows a loading state while the challenge library is being read', () => {
		render(turnOrderPage);

		expect(screen.getByText('Loading challenge…')).toBeTruthy();
	});

	it('generates and saves an order when no saved order exists', async () => {
		const challenge = createRunChallenge();
		delete challenge.runState?.generatedTurnOrder;
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Generate turn order' }));

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.generatedTurnOrder).toEqual([
				{ kind: 'turn', turnId: rookTurnId },
				{ kind: 'turn', turnId: ariaTurnId },
				{ kind: 'spawn' }
			]);
			expect(saved?.runState?.initiativeResults).toEqual(challenge.runState?.initiativeResults);
		});
		expect(screen.getByRole('button', { name: 'Recalculate' })).toBeTruthy();
	});

	it('lists missing results and preserves the saved order without navigating away', async () => {
		const challenge = createRunChallenge();
		delete challenge.runState?.initiativeResults[ariaTurnId];
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Recalculate' }));

		const missingTurns = await screen.findByRole('list', {
			name: 'Turns missing initiative results'
		});
		expectPageError('Turn order cannot be generated until every rolling turn has a result.');
		expect(within(missingTurns).getByText('Aria')).toBeTruthy();
		expect(mockedGoto).not.toHaveBeenCalled();
		expect((await loadChallengeLibrary()).challenges[0]?.runState?.generatedTurnOrder).toEqual([
			{ kind: 'turn', turnId: ariaTurnId },
			{ kind: 'turn', turnId: rookTurnId },
			{ kind: 'spawn' }
		]);
	});

	it('lists turns with unresolved placement rules', async () => {
		const challenge = createRunChallenge();
		challenge.runState = { initiativeResults: {} };
		challenge.creatures[0]!.turns[0]!.initiative = {
			kind: 'relative-position',
			relation: 'before',
			distance: 0,
			targetTurnId: rookTurnId
		};
		challenge.creatures[1]!.turns[0]!.initiative = {
			kind: 'relative-position',
			relation: 'before',
			distance: 0,
			targetTurnId: ariaTurnId
		};
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Generate turn order' }));

		const invalidTurns = await screen.findByRole('list', { name: 'Turns with invalid placement' });
		expectPageError('Turn placement could not be resolved.');
		expect(within(invalidTurns).getByText('Aria')).toBeTruthy();
		expect(within(invalidTurns).getByText('Rook')).toBeTruthy();
	});

	it.each([
		{ kind: 'unknown', message: 'The challenge was not found.' },
		{ kind: 'unreadable', message: 'The challenge could not be loaded.' }
	] as const)('shows recovery when the challenge is $kind', async ({ kind, message }) => {
		if (kind === 'unknown') {
			mockedPage.params = { challengeId: '00000000-0000-4000-8000-000000000099' };
		} else {
			vi.stubGlobal('indexedDB', undefined);
		}

		render(turnOrderPage);

		await screen.findByRole('alert');
		expectPageError(message);
		expect(screen.getByRole('link', { name: 'Return to challenges' }).getAttribute('href')).toBe(
			'/challenges'
		);
	});

	it('shows a save error when generating cannot be persisted', async () => {
		const challenge = createRunChallenge();
		delete challenge.runState?.generatedTurnOrder;
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);
		const generateButton = await screen.findByRole('button', { name: 'Generate turn order' });
		vi.stubGlobal('indexedDB', undefined);
		await fireEvent.click(generateButton);

		await screen.findByRole('alert');
		expectPageError('Changes could not be saved.');
		expect(mockedGoto).not.toHaveBeenCalled();
	});
});
