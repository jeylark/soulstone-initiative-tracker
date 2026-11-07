import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import turnOrderPage from './RunPanel.svelte';
import {
	loadChallengeLibrary,
	saveChallengeToLibrary,
	type Challenge,
	type StableId
} from '#lib/challenge';
import { createSetupChallenge, expectPageError } from '../../view-test-support';
import { ariaTurnId, rookTurnId, createRunChallenge } from './run/run-test-support';

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

	it('blocks generation while same-faction turns are tied', async () => {
		const challenge = createRunChallenge();
		challenge.runState = { initiativeResults: { [ariaTurnId]: 9, [rookTurnId]: 9 } };
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Generate turn order' }));

		expectPageError(
			'Turn order cannot be generated until tied turns in the same faction are ordered.'
		);
		expect(
			(await loadChallengeLibrary()).challenges[0]?.runState?.generatedTurnOrder
		).toBeUndefined();
	});

	it('generates from saved tie decisions and keeps only decisions for current ties', async () => {
		const challenge = createRunChallenge();
		const staleId = '00000000-0000-4000-8000-000000000099' as StableId;
		challenge.creatures[1]!.turns.push({
			id: staleId,
			initiative: { kind: 'static', value: 1 }
		});
		challenge.runState = {
			initiativeResults: { [ariaTurnId]: 9, [rookTurnId]: 9 },
			tieDecisions: [
				[rookTurnId, ariaTurnId],
				[ariaTurnId, staleId]
			]
		};
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Generate turn order' }));

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.generatedTurnOrder).toEqual([
				{ kind: 'turn', turnId: rookTurnId },
				{ kind: 'turn', turnId: ariaTurnId },
				{ kind: 'turn', turnId: staleId },
				{ kind: 'spawn' }
			]);
			expect(saved?.runState?.tieDecisions).toEqual([[rookTurnId, ariaTurnId]]);
		});
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

describe('turn-order run route', () => {
	const ariaTurnId = '00000000-0000-4000-8000-000000000023' as StableId;
	const rookTurnId = '00000000-0000-4000-8000-000000000024' as StableId;
	const ariaSecondTurnId = '00000000-0000-4000-8000-000000000027' as StableId;

	function createRunChallenge(): Challenge {
		const challenge = createSetupChallenge();
		challenge.name = 'Ashen Company';
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000025' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [{ id: ariaTurnId, initiative: { kind: 'roll', mode: 'manual' } }]
			},
			{
				id: '00000000-0000-4000-8000-000000000026' as StableId,
				kind: 'character',
				name: 'Rook',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [{ id: rookTurnId, initiative: { kind: 'roll', mode: 'manual' } }]
			}
		];
		challenge.runState = {
			initiativeResults: { [ariaTurnId]: 6, [rookTurnId]: 12 },
			generatedTurnOrder: [
				{ kind: 'turn', turnId: ariaTurnId },
				{ kind: 'turn', turnId: rookTurnId },
				{ kind: 'spawn' }
			]
		};
		return challenge;
	}

	it('renders the saved order as numbered faction-colored cards', async () => {
		const challenge = createRunChallenge();
		challenge.creatures[1]!.factionId = '00000000-0000-4000-8000-000000000003' as StableId;
		challenge.runState!.generatedTurnOrder = [
			{ kind: 'turn', turnId: rookTurnId },
			{ kind: 'turn', turnId: ariaTurnId },
			{ kind: 'spawn' }
		];
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);

		const savedOrder = await screen.findByRole('list', { name: 'Generated turn order' });
		const items = within(savedOrder).getAllByRole('listitem');
		expect(items.map((item) => item.querySelector('h2')?.textContent)).toEqual([
			'Rook',
			'Aria',
			'Spawn'
		]);
		expect(
			items.map((item) => item.querySelector('.turn-order-position')?.textContent?.trim())
		).toEqual(['1', '2', '3']);
		expect(items[0]?.textContent).toContain('Enemies');
		expect(items[1]?.textContent).toContain('Players');
		expect(
			items.map((item) =>
				item
					.querySelector<HTMLElement>('.turn-order-card-tone')
					?.style.getPropertyValue('--faction-color')
			)
		).toEqual(['#c76a6e', '#5687c8', undefined]);
	});

	it('hides and restores all turns for a creature without changing the saved order or results', async () => {
		const challenge = createRunChallenge();
		challenge.creatures[0]!.turns.push({
			id: ariaSecondTurnId,
			initiative: { kind: 'roll', mode: 'manual' }
		});
		challenge.runState!.initiativeResults[ariaSecondTurnId] = 8;
		challenge.runState!.generatedTurnOrder = [
			{ kind: 'turn', turnId: ariaTurnId },
			{ kind: 'turn', turnId: rookTurnId },
			{ kind: 'turn', turnId: ariaSecondTurnId },
			{ kind: 'spawn' }
		];
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);

		const visibilityControls = (await screen.findAllByRole('checkbox', {
			name: 'Hidden from viewers: Aria'
		})) as HTMLInputElement[];
		expect(visibilityControls).toHaveLength(2);
		expect(visibilityControls[0]?.checked).toBe(false);
		const initialOrder = screen.getByRole('list', { name: 'Generated turn order' });
		const initialItems = within(initialOrder).getAllByRole('listitem');
		const initialAriaItems = initialItems.filter((item) =>
			item.querySelector('h2')?.textContent?.startsWith('Aria')
		);
		expect(initialAriaItems).toHaveLength(2);
		for (const item of initialAriaItems) {
			expect(
				(
					within(item).getByRole('checkbox', {
						name: 'Hidden from viewers: Aria'
					}) as HTMLInputElement
				).checked
			).toBe(false);
		}
		await fireEvent.click(visibilityControls[0]!);

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.creatures[0]?.isHidden).toBe(true);
			expect(saved?.runState?.generatedTurnOrder).toEqual(challenge.runState?.generatedTurnOrder);
			expect(saved?.runState?.initiativeResults).toEqual(challenge.runState?.initiativeResults);
		});

		const savedOrder = screen.getByRole('list', { name: 'Generated turn order' });
		const items = within(savedOrder).getAllByRole('listitem');
		expect(items.map((item) => item.querySelector('h2')?.textContent)).toEqual([
			'Aria - Turn 1',
			'Rook',
			'Aria - Turn 2',
			'Spawn'
		]);
		const ariaItems = items.filter((item) =>
			item.querySelector('h2')?.textContent?.startsWith('Aria')
		);
		for (const item of ariaItems) {
			expect(item.textContent).toContain('Hidden');
			expect(item.querySelector('.turn-order-card-tone')?.classList.contains('is-hidden')).toBe(
				true
			);
			expect(
				(
					within(item).getByRole('checkbox', {
						name: 'Hidden from viewers: Aria'
					}) as HTMLInputElement
				).checked
			).toBe(true);
		}
		expect(items[1]?.querySelector('.turn-order-hidden')).toBeNull();
		expect(items[1]?.querySelector('.turn-order-card-tone')?.classList.contains('is-hidden')).toBe(
			false
		);

		cleanup();
		render(turnOrderPage);
		const restoredVisibilityControls = (await screen.findAllByRole('checkbox', {
			name: 'Hidden from viewers: Aria'
		})) as HTMLInputElement[];
		expect(restoredVisibilityControls).toHaveLength(2);
		expect(restoredVisibilityControls.every((control) => control.checked)).toBe(true);

		await fireEvent.click(restoredVisibilityControls[0]!);
		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.creatures[0]?.isHidden).toBe(false);
		});
		const visibleOrder = screen.getByRole('list', { name: 'Generated turn order' });
		expect(visibleOrder.querySelector('.turn-order-hidden')).toBeNull();
		for (const item of within(visibleOrder).getAllByRole('listitem')) {
			const checkbox = within(item).queryByRole('checkbox', {
				name: 'Hidden from viewers: Aria'
			}) as HTMLInputElement | null;
			if (checkbox) expect(checkbox.checked).toBe(false);
		}
	});

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
