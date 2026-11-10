import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUuid, saveChallengeToLibrary } from '#lib/challenge';
import {
	createSetupChallenge,
	createSpawnEditChallenge,
	renderSetup,
	setRelativeTarget
} from '../../../view-test-support';

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
	it('renders faction creatures in a responsive grid', async () => {
		await renderSetup();

		const faction = screen.getByRole('group', { name: 'Players' });
		await fireEvent.click(within(faction).getByRole('button', { name: 'Add Player' }));

		const player = within(faction).getByRole('group', { name: 'Player 1' });
		expect(
			player.closest('.entity-list-items')?.classList.contains('entity-list-items--grid')
		).toBe(true);
	});

	it('locks faction configuration and removal while allowing creature additions', async () => {
		await saveChallengeToLibrary(createSpawnEditChallenge());
		await renderSetup();

		const players = screen.getByRole('group', { name: 'Players' });
		expect(
			(screen.getByRole('textbox', { name: 'Faction name: Players' }) as HTMLInputElement).matches(
				':disabled'
			)
		).toBe(true);
		expect(
			(within(players).getByRole('button', { name: 'Remove faction Players' }) as HTMLButtonElement)
				.disabled
		).toBe(true);
		expect(
			(within(players).getByRole('button', { name: 'Add Player' }) as HTMLButtonElement).disabled
		).toBe(false);

		await fireEvent.click(within(players).getByRole('button', { name: 'Add Player' }));
		const player = within(players).getByRole('group', { name: 'Player 1' });
		expect(
			(within(player).getByRole('button', { name: 'Remove Player 1' }) as HTMLButtonElement)
				.disabled
		).toBe(false);
	});

	it('renders the unassigned creature list without inventing a faction or faction actions', async () => {
		const challenge = createSetupChallenge();
		challenge.creatures = [
			{
				id: createUuid(),
				kind: 'character',
				name: 'Orphan',
				factionId: createUuid(),
				isHidden: false,
				turns: [{ id: createUuid(), initiative: { kind: 'roll', mode: 'manual' } }]
			}
		];
		await saveChallengeToLibrary(challenge);
		await renderSetup();
		const group = within(screen.getByRole('region', { name: 'Unassigned creatures' }));
		const orphan = group.getByRole('group', { name: 'Orphan' });
		expect(orphan).toBeTruthy();
		expect(
			orphan.closest('.entity-list-items')?.classList.contains('entity-list-items--stack')
		).toBe(true);
		expect(group.queryByRole('button', { name: 'Add Player' })).toBeNull();
		expect(group.queryByRole('button', { name: /Remove faction/ })).toBeNull();
		expect(group.queryByRole('textbox', { name: /Faction name/ })).toBeNull();
	});

	it('prefers unused faction colors and allows color reuse', async () => {
		await renderSetup();

		const playersColors = screen.getByRole('group', { name: 'Faction color for Players' });
		const enemiesColors = screen.getByRole('group', { name: 'Faction color for Enemies' });
		expect(
			(within(playersColors).getByRole('radio', { name: 'Blue' }) as HTMLInputElement).checked
		).toBe(true);
		expect(
			(within(enemiesColors).getByRole('radio', { name: 'Red' }) as HTMLInputElement).checked
		).toBe(true);

		await fireEvent.click(screen.getByRole('button', { name: 'Add Faction' }));
		const factionColors = screen.getByRole('group', {
			name: 'Faction color for Faction 1'
		});
		expect(
			(within(factionColors).getByRole('radio', { name: 'Green' }) as HTMLInputElement).checked
		).toBe(true);

		await fireEvent.click(within(factionColors).getByRole('radio', { name: 'Blue' }));
		expect(
			(within(factionColors).getByRole('radio', { name: 'Blue' }) as HTMLInputElement).checked
		).toBe(true);
		expect(
			(within(playersColors).getByRole('radio', { name: 'Blue' }) as HTMLInputElement).checked
		).toBe(true);

		for (let index = 0; index < 8; index += 1) {
			await fireEvent.click(screen.getByRole('button', { name: 'Add Faction' }));
		}
		const selectedColors = screen
			.getAllByRole('group', { name: /Faction color for/ })
			.map((group) => group.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.value);
		expect(new Set(selectedColors).size).toBeLessThan(selectedColors.length);
	});

	it('confirms removing a faction and its creatures', async () => {
		await renderSetup();

		const factionPanel = screen.getByRole('group', { name: 'Players' });
		await fireEvent.click(within(factionPanel).getByRole('button', { name: 'Add Player' }));
		const player = within(factionPanel).getByRole('group', { name: 'Player 1' });
		const enemiesPanel = screen.getByRole('group', { name: 'Enemies' });
		await fireEvent.click(within(enemiesPanel).getByRole('button', { name: 'Add Player' }));
		const enemyPlayer = within(enemiesPanel).getByRole('group', { name: 'Player 2' });
		await setRelativeTarget('Player 2', 'Turn 1', 'before', 'Player 1 - Turn 1');
		expect(
			within(player)
				.getByRole('button', { name: 'Remove Player 1' })
				.classList.contains('ui-button--danger')
		).toBe(true);

		const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
		const removeFactionButton = within(factionPanel).getByRole('button', {
			name: 'Remove faction Players'
		});
		expect(removeFactionButton.classList.contains('ui-button--danger')).toBe(true);
		expect(removeFactionButton.textContent?.trim()).toBe('Remove faction');
		await fireEvent.click(removeFactionButton);
		expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('Remove faction "Players"'));
		expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('1 creature'));
		expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('1 dependent turn'));
		expect(player).toBeTruthy();
		expect(within(enemyPlayer).getByRole('group', { name: 'Turn 1' })).toBeTruthy();

		confirmation.mockReturnValue(true);
		await fireEvent.click(
			within(factionPanel).getByRole('button', { name: 'Remove faction Players' })
		);
		expect(screen.queryByRole('group', { name: 'Players' })).toBeNull();
		expect(screen.queryByRole('group', { name: 'Player 1' })).toBeNull();
		expect(within(enemyPlayer).queryByRole('group', { name: 'Turn 1' })).toBeNull();
	});
});
