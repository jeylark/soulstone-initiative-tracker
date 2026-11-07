import { IDBFactory } from 'fake-indexeddb';
import { cleanup, render, screen, within } from '@testing-library/svelte';
import { saveChallengeToLibrary, type StableId } from '#lib/challenge';
import { ariaTurnId, rookTurnId, createRunChallenge } from './run-test-support';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import turnOrderPage from './+page.svelte';
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

describe('turn list', () => {
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
});
