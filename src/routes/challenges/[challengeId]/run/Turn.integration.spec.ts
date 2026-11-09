import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { saveChallengeToLibrary, loadChallengeLibrary, type StableId } from '#lib/challenge';
import { ariaTurnId, rookTurnId, createRunChallenge } from './run-test-support';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import turnOrderPage from '../RunPanel.svelte';
import { createSetupChallenge } from '../../../view-test-support';

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

describe('turn', () => {
	const ariaSecondTurnId = '00000000-0000-4000-8000-000000000027' as StableId;

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
			item.querySelector('.turn-order-creature-name')?.textContent?.startsWith('Aria')
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
		expect(
			items.slice(0, 3).map((item) => item.querySelector('.turn-order-creature-name')?.textContent)
		).toEqual(['Aria - Turn 1', 'Rook', 'Aria - Turn 2']);
		expect(within(items[3]!).getByRole('heading', { name: 'Spawn' })).toBeTruthy();
		const ariaItems = items.filter((item) =>
			item.querySelector('.turn-order-creature-name')?.textContent?.startsWith('Aria')
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
});
