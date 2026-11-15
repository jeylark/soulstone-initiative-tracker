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
	it('groups creature controls, including visibility, separately from their turn list', async () => {
		await renderSetup();
		const players = screen.getByRole('group', { name: 'Players' });
		await fireEvent.click(within(players).getByRole('button', { name: 'Add Player' }));
		const player = within(players).getByRole('group', { name: 'Player 1' });
		const name = within(player).getByRole('textbox', { name: 'Character name: Player 1' });
		const visibility = within(player).getByRole('checkbox', { name: 'Start hidden Player 1' });
		const group = name.closest('.form-group');
		expect(group?.classList.contains('creature-fields')).toBe(true);
		expect(visibility.closest('.form-group')).toBe(group);
		expect(group?.querySelector('.creature-turn-list')).toBeNull();
	});

	it('locks an existing creature configuration but leaves removal and new creatures available', async () => {
		await saveChallengeToLibrary(createSpawnEditChallenge());
		await renderSetup();

		const players = screen.getByRole('group', { name: 'Players' });
		const aria = within(players).getByRole('group', { name: 'Aria' });
		const heading = screen.getByRole('heading', { level: 4, name: 'Aria' });
		expect(heading.parentElement).toBe(aria.parentElement);
		expect(heading.classList.contains('card-header--medium')).toBe(true);
		expect(aria.parentElement?.classList.contains('card--surface')).toBe(true);
		expect(aria.parentElement?.classList.contains('card--compact')).toBe(true);
		expect(
			(within(aria).getByRole('textbox', { name: 'Character name: Aria' }) as HTMLInputElement)
				.disabled
		).toBe(true);
		expect(
			(within(aria).getByRole('button', { name: 'Remove Aria' }) as HTMLButtonElement).disabled
		).toBe(false);

		await fireEvent.click(within(players).getByRole('button', { name: 'Add Player' }));
		const player = within(players).getByRole('group', { name: 'Player 1' });
		expect(
			(
				within(player).getByRole('textbox', {
					name: 'Character name: Player 1'
				}) as HTMLInputElement
			).disabled
		).toBe(false);
	});

	it('shows a missing NPC type instead of silently selecting another and permits repair', async () => {
		const challenge = createSetupChallenge();
		challenge.name = 'Missing type';
		const typeId = createUuid();
		challenge.npcTypes = [{ id: typeId, name: 'Sentinel', initiativeStat: 2 }];
		challenge.creatures = [
			{
				id: createUuid(),
				kind: 'npc',
				creatureTypeId: createUuid(),
				identifier: '1',
				factionId: challenge.factions[1].id,
				isHidden: false,
				turns: []
			}
		];
		await saveChallengeToLibrary(challenge);
		await renderSetup();
		const selector = screen.getByRole('combobox', { name: 'NPC type for NPC 1' });
		expect(selector.getAttribute('aria-invalid')).toBe('true');
		expect((selector as HTMLSelectElement).selectedOptions[0].textContent).toBe('Missing NPC type');
		await fireEvent.change(selector, { target: { value: typeId } });
		expect(
			screen.getByRole('combobox', { name: 'NPC type for Sentinel 1' }).getAttribute('aria-invalid')
		).not.toBe('true');
	});

	it('adds players and NPCs to their faction without opening forms', async () => {
		await renderSetup();

		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		const playersPanel = screen.getByRole('group', { name: 'Players' });
		const enemiesPanel = screen.getByRole('group', { name: 'Enemies' });

		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		const player = within(playersPanel).getByRole('group', { name: 'Player 1' });
		expect(player).toBeTruthy();
		expect(
			(within(player).getByRole('combobox', { name: 'Turn initiative' }) as HTMLSelectElement).value
		).toBe('roll-manual');
		expect(within(player).getByRole('option', { name: 'Calculate roll' })).toBeTruthy();
		expect(within(player).getByRole('option', { name: 'Enter a result' })).toBeTruthy();
		expect(
			within(playersPanel).queryByRole('textbox', { name: 'Character name for Players' })
		).toBeNull();

		await fireEvent.click(within(enemiesPanel).getByRole('button', { name: 'Add NPC' }));
		const npc = within(enemiesPanel).getByRole('group', { name: 'NPC Type 1 1' });
		expect(npc).toBeTruthy();
		expect(
			(within(npc).getByRole('combobox', { name: 'Turn initiative' }) as HTMLSelectElement).value
		).toBe('roll-app');
		expect(screen.queryByRole('button', { name: /Use NPC type|Selected/ })).toBeNull();
		await fireEvent.click(within(npc).getByRole('button', { name: 'Add turn for NPC Type 1 1' }));
		expect(
			(
				within(npc)
					.getByRole('group', { name: 'Turn 2' })
					.querySelector('select') as HTMLSelectElement
			).value
		).toBe('roll-app');
		expect(
			within(enemiesPanel).queryByRole('textbox', { name: 'NPC identifier for Enemies' })
		).toBeNull();
	});

	it('hides a creature with zero turns and keeps its visibility when turns are added', async () => {
		await renderSetup();

		const playersPanel = screen.getByRole('group', { name: 'Players' });
		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		const player = within(playersPanel).getByRole('group', { name: 'Player 1' });
		const visibility = within(player).getByRole('checkbox', {
			name: 'Start hidden Player 1'
		}) as HTMLInputElement;

		expect(visibility.checked).toBe(false);
		await fireEvent.click(visibility);
		expect(visibility.checked).toBe(true);

		await fireEvent.click(
			within(player).getByRole('button', { name: 'Remove Turn 1 for Player 1' })
		);
		expect(within(player).queryByRole('group', { name: 'Turn 1' })).toBeNull();
		expect(visibility.checked).toBe(true);

		await fireEvent.click(within(player).getByRole('button', { name: 'Add turn for Player 1' }));
		expect(within(player).getByRole('group', { name: 'Turn 1' })).toBeTruthy();
		await fireEvent.click(within(player).getByRole('button', { name: 'Add turn for Player 1' }));
		expect(within(player).getByRole('group', { name: 'Turn 2' })).toBeTruthy();
		expect(visibility.checked).toBe(true);

		await fireEvent.click(visibility);
		expect(visibility.checked).toBe(false);
	});

	it('confirms deleting a creature will also delete turns that reference it', async () => {
		await renderSetup();

		const playersPanel = screen.getByRole('group', { name: 'Players' });
		const enemiesPanel = screen.getByRole('group', { name: 'Enemies' });
		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		await fireEvent.click(within(enemiesPanel).getByRole('button', { name: 'Add Player' }));
		const player = within(playersPanel).getByRole('group', { name: 'Player 1' });
		const enemy = within(enemiesPanel).getByRole('group', { name: 'Player 2' });
		await setRelativeTarget('Player 2', 'Turn 1', 'before', 'Player 1 - Turn 1');

		const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
		await fireEvent.click(within(player).getByRole('button', { name: 'Remove Player 1' }));
		expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('1 dependent turn'));
		expect(player).toBeTruthy();
		expect(within(enemy).getByRole('group', { name: 'Turn 1' })).toBeTruthy();

		confirmation.mockReturnValue(true);
		await fireEvent.click(within(player).getByRole('button', { name: 'Remove Player 1' }));
		expect(screen.queryByRole('group', { name: 'Player 1' })).toBeNull();
		expect(within(enemy).queryByRole('group', { name: 'Turn 1' })).toBeNull();
	});

	it('lets each NPC change type and uses the most recently selected type across factions', async () => {
		await renderSetup();

		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		const enemiesPanel = screen.getByRole('group', { name: 'Enemies' });
		const playersPanel = screen.getByRole('group', { name: 'Players' });
		await fireEvent.click(within(enemiesPanel).getByRole('button', { name: 'Add NPC' }));
		const firstNpc = within(enemiesPanel).getByRole('group', { name: 'NPC Type 1 1' });

		const typeSelector = within(firstNpc).getByRole('combobox', {
			name: 'NPC type for NPC Type 1 1'
		});
		const typeOption = within(firstNpc).getByRole('option', { name: 'NPC Type 2' });
		await fireEvent.change(typeSelector, { target: { value: typeOption.getAttribute('value') } });
		expect(within(enemiesPanel).getByRole('group', { name: 'NPC Type 2 1' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: /Use NPC type|Selected/ })).toBeNull();

		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add NPC' }));
		expect(within(playersPanel).getByRole('group', { name: 'NPC Type 2 2' })).toBeTruthy();
	});

	it('changes a colliding NPC identifier but preserves it when the new type has no duplicate', async () => {
		await renderSetup();

		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		const enemiesPanel = screen.getByRole('group', { name: 'Enemies' });
		await fireEvent.click(within(enemiesPanel).getByRole('button', { name: 'Add NPC' }));
		const firstNpc = within(enemiesPanel).getByRole('group', { name: 'NPC Type 1 1' });
		await fireEvent.click(within(enemiesPanel).getByRole('button', { name: 'Add NPC' }));
		const firstTypeSecondNpc = within(enemiesPanel).getByRole('group', { name: 'NPC Type 1 2' });

		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		const secondTypeSelector = within(firstTypeSecondNpc).getByRole('combobox', {
			name: 'NPC type for NPC Type 1 2'
		});
		const secondTypeOption = within(firstTypeSecondNpc).getByRole('option', {
			name: 'NPC Type 2'
		});
		await fireEvent.change(secondTypeSelector, {
			target: { value: secondTypeOption.getAttribute('value') }
		});
		await fireEvent.click(within(enemiesPanel).getByRole('button', { name: 'Add NPC' }));
		const secondNpc = within(enemiesPanel).getByRole('group', { name: 'NPC Type 2 1' });

		const firstTypeSelector = within(firstNpc).getByRole('combobox', {
			name: 'NPC type for NPC Type 1 1'
		});
		const secondTypeOptionForFirstNpc = within(firstNpc).getByRole('option', {
			name: 'NPC Type 2'
		});
		await fireEvent.change(firstTypeSelector, {
			target: { value: secondTypeOptionForFirstNpc.getAttribute('value') }
		});
		const reassignedNpc = within(enemiesPanel).getByRole('group', { name: 'NPC Type 2 3' });
		expect(reassignedNpc).toBeTruthy();

		const originalTypeTwoNpcSelector = within(secondNpc).getByRole('combobox', {
			name: 'NPC type for NPC Type 2 1'
		});
		const firstTypeOption = within(secondNpc).getByRole('option', { name: 'NPC Type 1' });
		await fireEvent.change(originalTypeTwoNpcSelector, {
			target: { value: firstTypeOption.getAttribute('value') }
		});
		expect(within(enemiesPanel).getByRole('group', { name: 'NPC Type 1 1' })).toBeTruthy();
	});
});
