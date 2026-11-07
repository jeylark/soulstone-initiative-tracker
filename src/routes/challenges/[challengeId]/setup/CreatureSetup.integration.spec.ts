import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveChallengeToLibrary } from '#lib/challenge';
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
	it('adds factions and NPC types immediately with sensible defaults', async () => {
		await renderSetup();

		await fireEvent.click(screen.getByRole('button', { name: 'Add Faction' }));
		expect(screen.getByRole('group', { name: 'Faction 1' })).toBeTruthy();
		expect(screen.queryByRole('textbox', { name: 'New faction name' })).toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		expect(screen.getByRole('group', { name: 'NPC Type 1' })).toBeTruthy();
		expect(screen.getByRole('textbox', { name: 'NPC type name: NPC Type 1' })).toBeTruthy();
		expect(screen.getByRole('spinbutton', { name: 'Initiative stat for NPC Type 1' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: /Use NPC type|Selected/ })).toBeNull();
		expect(screen.queryByRole('textbox', { name: 'New NPC type name' })).toBeNull();
	});
});
