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
	it('restores a saved order without offering generation again', async () => {
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
		expect(screen.queryByRole('button', { name: 'Generate turn order' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Recalculate' })).toBeNull();
		expect(mockedGoto).not.toHaveBeenCalled();
	});

	it('groups challenge details and controls before the turn cards', async () => {
		const challenge = createRunChallenge();
		render(turnOrderPage, { sharedChallenge: challenge });

		const controls = await screen.findByRole('region', {
			name: 'Challenge controls and status'
		});
		const turnCards = screen.getByRole('region', { name: 'Turn cards' });
		expect(within(controls).getByText('Ashen Company')).toBeTruthy();
		expect(within(controls).getByRole('button', { name: 'Next turn' })).toBeTruthy();
		expect(within(controls).queryByRole('button', { name: 'Recalculate' })).toBeNull();
		expect(within(turnCards).getByRole('list', { name: 'Generated turn order' })).toBeTruthy();
		expect(
			controls.compareDocumentPosition(turnCards) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
	});

	it('advances to the next turn, counts spawns, and saves the rotated order', async () => {
		const challenge = createRunChallenge();
		const staticTurnId = '00000000-0000-4000-8000-000000000028' as StableId;
		challenge.creatures.push({
			id: '00000000-0000-4000-8000-000000000029' as StableId,
			kind: 'character',
			name: 'Mira',
			factionId: '00000000-0000-4000-8000-000000000002' as StableId,
			isHidden: false,
			turns: [{ id: staticTurnId, initiative: { kind: 'static', value: 3 } }]
		});
		challenge.runState!.initiativeResults[ariaTurnId] = 0;
		challenge.runState!.generatedTurnOrder!.splice(2, 0, {
			kind: 'turn',
			turnId: staticTurnId
		});
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);
		expect(await screen.findByText('Spawns: 0')).toBeTruthy();
		expect(screen.getByText('Initiative: 0')).toBeTruthy();
		expect(screen.getByText('Initiative: 12')).toBeTruthy();
		expect(screen.getByText('Initiative: 3')).toBeTruthy();
		const titles = () =>
			within(screen.getByRole('list', { name: 'Generated turn order' }))
				.getAllByRole('listitem')
				.map((item) => item.querySelector('h2')?.textContent);

		const next = () => screen.getByRole('button', { name: 'Next turn' }) as HTMLButtonElement;

		await fireEvent.click(next());
		await waitFor(() => expect(titles()).toEqual(['Rook', 'Mira', 'Spawn', 'Aria']));
		const rotatedOrder = screen.getByRole('list', { name: 'Generated turn order' });
		expect(within(rotatedOrder).getByText('Initiative: 12')).toBeTruthy();
		expect(within(rotatedOrder).getByText('Initiative: 3')).toBeTruthy();
		expect(within(rotatedOrder).getByText('Initiative: 0')).toBeTruthy();
		await waitFor(() => expect(next().disabled).toBe(false));
		await fireEvent.click(next());
		await waitFor(() => expect(titles()).toEqual(['Mira', 'Spawn', 'Aria', 'Rook']));
		expect(screen.getByText('Spawns: 0')).toBeTruthy();
		await waitFor(() => expect(next().disabled).toBe(false));
		await fireEvent.click(next());
		await waitFor(() => expect(titles()).toEqual(['Spawn', 'Aria', 'Rook', 'Mira']));
		await waitFor(() => expect(next().disabled).toBe(false));
		await fireEvent.click(next());

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.spawnCount).toBe(1);
			expect(saved?.runState?.generatedTurnOrder).toEqual([
				{ kind: 'turn', turnId: ariaTurnId },
				{ kind: 'turn', turnId: rookTurnId },
				{ kind: 'turn', turnId: staticTurnId },
				{ kind: 'spawn' }
			]);
		});
		expect(screen.getByText('Spawns: 1')).toBeTruthy();
	});

	it('hides the next-turn button until an order exists', async () => {
		const challenge = createRunChallenge();
		delete challenge.runState?.generatedTurnOrder;
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);
		await screen.findByRole('button', { name: 'Generate turn order' });
		expect(screen.queryByRole('button', { name: 'Next turn' })).toBeNull();
	});

	it('skips hidden turns while keeping them visible and stopping at Spawn', async () => {
		const challenge = createRunChallenge();
		challenge.creatures[1]!.isHidden = true;
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);
		const next = () => screen.getByRole('button', { name: 'Next turn' }) as HTMLButtonElement;
		const titles = () =>
			within(screen.getByRole('list', { name: 'Generated turn order' }))
				.getAllByRole('listitem')
				.map((item) => item.querySelector('h2')?.textContent);

		expect(await screen.findByText('Spawns: 0')).toBeTruthy();
		await fireEvent.click(next());
		await waitFor(() => expect(titles()).toEqual(['Spawn', 'Aria', 'Rook']));
		expect(screen.getByText('Spawns: 0')).toBeTruthy();
		const order = screen.getByRole('list', { name: 'Generated turn order' });
		const hiddenRook = within(order)
			.getAllByRole('listitem')
			.find((item) => item.querySelector('h2')?.textContent === 'Rook');
		expect(hiddenRook?.textContent).toContain('Hidden');

		await waitFor(() => expect(next().disabled).toBe(false));
		await fireEvent.click(next());
		await waitFor(() => expect(titles()).toEqual(['Aria', 'Rook', 'Spawn']));
		await waitFor(() => expect(screen.getByText('Spawns: 1')).toBeTruthy());
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
		expect(screen.queryByRole('button', { name: 'Generate turn order' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Recalculate' })).toBeNull();

		cleanup();
		render(turnOrderPage);
		expect(await screen.findByRole('list', { name: 'Generated turn order' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Generate turn order' })).toBeNull();
	});

	it('shows a non-blocking warning when placement values are clamped', async () => {
		const challenge = createRunChallenge();
		delete challenge.runState?.generatedTurnOrder;
		challenge.creatures[0]!.turns[0]!.initiative = {
			kind: 'fixed-position',
			from: 'top',
			position: 99
		};
		challenge.runState = { initiativeResults: { [rookTurnId]: 7 } };
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Generate turn order' }));

		expect(
			await screen.findByText('Some placement values exceed the available order and were clamped.')
		).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Generate turn order' })).toBeNull();
		expect(screen.getByRole('list', { name: 'Turns with clamped placement' })).toBeTruthy();
	});

	it('lists missing results and preserves the saved order without navigating away', async () => {
		const challenge = createRunChallenge();
		delete challenge.runState?.initiativeResults[ariaTurnId];
		delete challenge.runState?.generatedTurnOrder;
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Generate turn order' }));

		const missingTurns = await screen.findByRole('list', {
			name: 'Turns missing initiative results'
		});
		expectPageError('Turn order cannot be generated until every rolling turn has a result.');
		expect(within(missingTurns).getByText('Aria')).toBeTruthy();
		expect(mockedGoto).not.toHaveBeenCalled();
		expect(
			(await loadChallengeLibrary()).challenges[0]?.runState?.generatedTurnOrder
		).toBeUndefined();
	});

	it('explains that unknown saved turns are omitted', async () => {
		const challenge = createRunChallenge();
		challenge.runState!.generatedTurnOrder!.unshift({
			kind: 'turn',
			turnId: '00000000-0000-4000-8000-000000000099' as StableId
		});

		render(turnOrderPage, { props: { sharedChallenge: challenge } });

		expect(
			await screen.findByText(
				'Some saved turns are no longer in this challenge and are omitted from the turn order.'
			)
		).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Generate turn order' })).toBeNull();
	});

	it('blocks generation while same-faction turns are tied', async () => {
		const challenge = createRunChallenge();
		challenge.runState = { initiativeResults: { [ariaTurnId]: 9, [rookTurnId]: 9 } };
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Generate turn order' }));

		expectPageError(
			'Turn order cannot be generated until tied turns in the same faction are ordered on the Roll tab.'
		);
		const ties = screen.getByRole('list', { name: 'Unresolved initiative ties' });
		expect(within(ties).getByText('Aria, Rook')).toBeTruthy();
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
			targetTurnId: rookTurnId
		};
		challenge.creatures[1]!.turns[0]!.initiative = {
			kind: 'relative-position',
			relation: 'before',
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
		expect(screen.getByRole('button', { name: 'Generate turn order' })).toBeTruthy();
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

	it('renders the saved order as faction-colored cards without position indices', async () => {
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
		expect(items.every((item) => item.querySelector('.turn-order-position') === null)).toBe(true);
		expect(items[0]?.textContent).toContain('Initiative: 12');
		expect(items[1]?.textContent).toContain('Initiative: 6');
		expect(items[2]?.textContent).not.toContain('Initiative:');
		expect(items[0]?.textContent).not.toContain('Enemies');
		expect(items[1]?.textContent).not.toContain('Players');
		expect(
			items.map((item) =>
				item
					.querySelector<HTMLElement>('.turn-order-card-tone')
					?.style.getPropertyValue('--faction-color')
			)
		).toEqual(['light-dark(#d32f2f, #ff6b6b)', 'light-dark(#1f5fbf, #5c9dff)', undefined]);
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
			expect(within(item).getByText('Hidden', { selector: 'span' })).toBeTruthy();
			expect(item.querySelector('.turn-order-hidden')).toBeNull();
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

	it('restores a saved order without offering generation again', async () => {
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
		expect(screen.queryByRole('button', { name: 'Generate turn order' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Recalculate' })).toBeNull();
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
		expect(screen.queryByRole('button', { name: 'Generate turn order' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Recalculate' })).toBeNull();
	});

	it('lists missing results and preserves the saved order without navigating away', async () => {
		const challenge = createRunChallenge();
		delete challenge.runState?.initiativeResults[ariaTurnId];
		delete challenge.runState?.generatedTurnOrder;
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Generate turn order' }));

		const missingTurns = await screen.findByRole('list', {
			name: 'Turns missing initiative results'
		});
		expectPageError('Turn order cannot be generated until every rolling turn has a result.');
		expect(within(missingTurns).getByText('Aria')).toBeTruthy();
		expect(mockedGoto).not.toHaveBeenCalled();
		expect(
			(await loadChallengeLibrary()).challenges[0]?.runState?.generatedTurnOrder
		).toBeUndefined();
	});

	it('lists turns with unresolved placement rules', async () => {
		const challenge = createRunChallenge();
		challenge.runState = { initiativeResults: {} };
		challenge.creatures[0]!.turns[0]!.initiative = {
			kind: 'relative-position',
			relation: 'before',
			targetTurnId: rookTurnId
		};
		challenge.creatures[1]!.turns[0]!.initiative = {
			kind: 'relative-position',
			relation: 'before',
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

describe('Spawn editing transitions', () => {
	const spawnOnly = () => [{ kind: 'spawn' as const }];

	async function seedSpawnChallenge(): Promise<void> {
		const challenge = createRunChallenge();
		challenge.runState!.generatedTurnOrder = [
			{ kind: 'spawn' },
			{ kind: 'turn', turnId: ariaTurnId },
			{ kind: 'turn', turnId: rookTurnId }
		];
		challenge.runState!.spawnCount = 2;
		await saveChallengeToLibrary(challenge);
		mockedPage.params = { challengeId: challenge.id };
	}

	const savedRunState = async () => (await loadChallengeLibrary()).challenges[0]?.runState;
	const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

	async function startEditing(onTabChange = vi.fn()): Promise<void> {
		render(turnOrderPage, { onTabChange });
		await fireEvent.click(await screen.findByRole('button', { name: 'Edit Challenge' }));
		await waitFor(() => expect(onTabChange).toHaveBeenCalledWith('setup'));
	}

	it('disables Edit Challenge unless Spawn is current', async () => {
		const challenge = createRunChallenge();
		await saveChallengeToLibrary(challenge);
		mockedPage.params = { challengeId: challenge.id };
		render(turnOrderPage);

		await screen.findByRole('button', { name: 'Edit Challenge' });
		expect(button('Edit Challenge').disabled).toBe(true);
		expect(button('Next turn').disabled).toBe(false);
	});

	it('saves entry state before opening Setup and locks Next turn', async () => {
		await seedSpawnChallenge();
		const onTabChange = vi.fn(async () => {
			expect((await savedRunState())?.spawnEdit).toBeDefined();
		});
		await startEditing(onTabChange);

		expect(await savedRunState()).toMatchObject({
			generatedTurnOrder: spawnOnly(),
			spawnCount: 2,
			initiativeResults: { [ariaTurnId]: 6, [rookTurnId]: 12 },
			spawnEdit: {
				newCreatureIds: [],
				newNpcTypeIds: [],
				newTurnIds: [],
				lockedInitiativeTurnIds: [ariaTurnId, rookTurnId]
			}
		});
		expect(button('Next turn').disabled).toBe(true);
		expect(button('Edit Challenge').disabled).toBe(true);
	});

	it('stays on Run and keeps the prior state when entry cannot be saved', async () => {
		await seedSpawnChallenge();
		const onTabChange = vi.fn();
		render(turnOrderPage, { onTabChange });
		const edit = await screen.findByRole('button', { name: 'Edit Challenge' });
		vi.stubGlobal('indexedDB', undefined);
		await fireEvent.click(edit);

		await screen.findByRole('alert');
		expect(onTabChange).not.toHaveBeenCalled();
		expect(button('Next turn').disabled).toBe(false);
		expect(screen.queryByRole('button', { name: 'Calculate Turn Order' })).toBeNull();
	});

	it('reports missing results and keeps editing active', async () => {
		await seedSpawnChallenge();
		const challenge = (await loadChallengeLibrary()).challenges[0]!;
		delete challenge.runState!.initiativeResults[ariaTurnId];
		await saveChallengeToLibrary(challenge);
		await startEditing();

		await fireEvent.click(await screen.findByRole('button', { name: 'Calculate Turn Order' }));

		expect(
			await screen.findByRole('list', { name: 'Turns missing initiative results' })
		).toBeTruthy();
		const runState = await savedRunState();
		expect(runState?.spawnEdit).toBeDefined();
		expect(runState?.generatedTurnOrder).toEqual(spawnOnly());
	});

	it('calculates with Spawn first, relocks, and counts Spawn once on Next turn', async () => {
		await seedSpawnChallenge();
		await startEditing();

		await fireEvent.click(await screen.findByRole('button', { name: 'Calculate Turn Order' }));

		await waitFor(async () => expect((await savedRunState())?.spawnEdit).toBeUndefined());
		expect(await savedRunState()).toMatchObject({
			spawnCount: 2,
			initiativeResults: { [ariaTurnId]: 6, [rookTurnId]: 12 },
			generatedTurnOrder: [
				{ kind: 'spawn' },
				{ kind: 'turn', turnId: rookTurnId },
				{ kind: 'turn', turnId: ariaTurnId }
			]
		});
		expect(screen.queryByRole('button', { name: 'Calculate Turn Order' })).toBeNull();
		await fireEvent.click(button('Next turn'));
		await waitFor(async () => expect((await savedRunState())?.spawnCount).toBe(3));
	});

	it('restores editing when calculation cannot be saved', async () => {
		await seedSpawnChallenge();
		await startEditing();
		const calculate = await screen.findByRole('button', { name: 'Calculate Turn Order' });
		vi.stubGlobal('indexedDB', undefined);
		await fireEvent.click(calculate);

		await screen.findByRole('alert');
		expect(screen.getByRole('button', { name: 'Calculate Turn Order' })).toBeTruthy();
		expect(button('Next turn').disabled).toBe(true);
	});
});
