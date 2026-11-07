import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveChallengeToLibrary } from '#lib/challenge';
import {
	createSetupChallenge,
	renderSetup,
	setRelativeTarget
} from '../../../routes/view-test-support';

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
	it('confirms removing an NPC type and its creatures', async () => {
		await renderSetup();

		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));

		const factionPanel = screen.getByRole('group', { name: 'Enemies' });
		await fireEvent.click(within(factionPanel).getByRole('button', { name: 'Add NPC' }));
		const npc = within(factionPanel).getByRole('group', { name: 'NPC Type 1 1' });
		const playersPanel = screen.getByRole('group', { name: 'Players' });
		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		const player = within(playersPanel).getByRole('group', { name: 'Player 1' });
		await setRelativeTarget('Player 1', 'Turn 1', 'after', 'NPC Type 1 1 - Turn 1');

		const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
		const removeNpcTypeButton = screen.getByRole('button', {
			name: 'Remove NPC type NPC Type 1'
		});
		expect(removeNpcTypeButton.classList.contains('ui-button--danger')).toBe(true);
		expect(removeNpcTypeButton.textContent?.trim()).toBe('Remove NPC type');
		await fireEvent.click(removeNpcTypeButton);
		expect(confirmation).toHaveBeenCalledWith(
			expect.stringContaining('Remove NPC type "NPC Type 1"')
		);
		expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('1 NPC'));
		expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('1 dependent turn'));
		expect(npc).toBeTruthy();
		expect(within(player).getByRole('group', { name: 'Turn 1' })).toBeTruthy();

		confirmation.mockReturnValue(true);
		await fireEvent.click(screen.getByRole('button', { name: 'Remove NPC type NPC Type 1' }));
		expect(screen.queryByRole('group', { name: 'NPC Type 1 1' })).toBeNull();
		expect(screen.queryByRole('group', { name: 'NPC Type 1' })).toBeNull();
		expect(within(player).queryByRole('group', { name: 'Turn 1' })).toBeNull();
	});
});
