import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUuid, loadChallengeLibrary, saveChallengeToLibrary } from '#lib/challenge';
import { createSetupChallenge, renderSetup } from '../../../view-test-support';

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

describe('new challenge setup', () => {
	it('keeps creatures with missing factions visible and saves explicit reassignment', async () => {
		const challenge = createSetupChallenge();
		challenge.name = 'Orphan recovery';
		challenge.creatures = [
			{
				id: createUuid(),
				kind: 'character',
				name: 'Hero',
				factionId: createUuid(),
				isHidden: false,
				turns: []
			}
		];
		await saveChallengeToLibrary(challenge);
		await renderSetup();
		const group = screen.getByRole('region', { name: 'Unassigned creatures' });
		expect(within(group).getByRole('group', { name: 'Hero' })).toBeTruthy();
		const selector = screen.getByRole('combobox', { name: 'Faction for Hero' });
		expect(selector.getAttribute('aria-invalid')).toBe('true');
		await fireEvent.change(selector, { target: { value: challenge.factions[0].id } });
		expect(screen.queryByRole('region', { name: 'Unassigned creatures' })).toBeNull();
		expect(
			within(screen.getByRole('group', { name: 'Players' })).getByRole('group', { name: 'Hero' })
		).toBeTruthy();
		await waitFor(async () =>
			expect((await loadChallengeLibrary()).challenges[0].creatures[0].factionId).toBe(
				challenge.factions[0].id
			)
		);
	});

	it('adds factions and NPC types immediately with sensible defaults', async () => {
		await renderSetup();

		await fireEvent.click(screen.getByRole('button', { name: 'Add Faction' }));
		expect(screen.getByRole('group', { name: 'Faction 1' })).toBeTruthy();
		expect(screen.queryByRole('textbox', { name: 'New faction name' })).toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		expect(screen.getByRole('group', { name: 'NPC Type 1' })).toBeTruthy();
		expect(screen.getByRole('textbox', { name: 'NPC type name: NPC Type 1' })).toBeTruthy();
		const statInput = screen.getByRole('spinbutton', { name: 'Initiative stat for NPC Type 1' });
		expect(statInput.getAttribute('min')).toBe('0');
		await fireEvent.input(statInput, { target: { value: '0' } });
		expect((statInput as HTMLInputElement).value).toBe('0');
		expect(screen.queryByRole('button', { name: /Use NPC type|Selected/ })).toBeNull();
		expect(screen.queryByRole('textbox', { name: 'New NPC type name' })).toBeNull();
	});
});
