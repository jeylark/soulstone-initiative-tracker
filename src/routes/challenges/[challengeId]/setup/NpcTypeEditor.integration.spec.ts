import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUuid, loadChallengeLibrary, saveChallengeToLibrary } from '#lib/challenge';
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
	it('initializes the NPC default after reload and permits only new type configuration', async () => {
		const challenge = createSpawnEditChallenge();
		const firstTypeId = createUuid();
		const secondTypeId = createUuid();
		challenge.npcTypes = [
			{ id: firstTypeId, name: 'Sentinel', initiativeStat: 2 },
			{ id: secondTypeId, name: 'Scout', initiativeStat: 1 }
		];
		await saveChallengeToLibrary(challenge);
		await renderSetup();

		expect(
			(screen.getByRole('textbox', { name: 'NPC type name: Sentinel' }) as HTMLInputElement)
				.disabled
		).toBe(true);
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		const newType = screen.getByRole('group', { name: 'NPC Type 1' });
		const heading = screen.getByRole('heading', { level: 3, name: 'NPC Type 1' });
		const newTypeCard = newType.closest('.card');
		expect(newTypeCard).not.toBeNull();
		expect(heading.closest('.card')).toBe(newTypeCard);
		expect(heading.classList.contains('card-header--small')).toBe(true);
		expect(newTypeCard?.classList.contains('card--subtle')).toBe(true);
		expect(newTypeCard?.classList.contains('card--compact')).toBe(true);
		expect(
			(
				within(newType).getByRole('textbox', {
					name: 'NPC type name: NPC Type 1'
				}) as HTMLInputElement
			).disabled
		).toBe(false);

		const enemies = screen.getByRole('group', { name: 'Enemies' });
		await fireEvent.click(within(enemies).getByRole('button', { name: 'Add NPC' }));
		const firstNpc = within(enemies).getByRole('group', { name: 'Sentinel 1' });
		const npcId = firstNpc.getAttribute('data-entity-id');
		const npcTurnId = within(firstNpc)
			.getByRole('group', { name: 'Turn 1' })
			.getAttribute('data-entity-id');
		expect(
			within(firstNpc).getByRole('combobox', { name: 'NPC type for Sentinel 1' })
		).toBeTruthy();
		expect(
			(within(firstNpc).getByRole('textbox', { name: 'NPC identifier' }) as HTMLInputElement)
				.disabled
		).toBe(false);
		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0]!;
			expect(saved.runState?.spawnEdit?.newNpcTypeIds).toContain(
				newType.getAttribute('data-entity-id')
			);
			expect(saved.runState?.spawnEdit?.newCreatureIds).toContain(npcId);
			expect(saved.runState?.spawnEdit?.newTurnIds).toContain(npcTurnId);
		});
	});

	it('falls back after removing the selected type and clears permissions when the final type is removed', async () => {
		const challenge = createSpawnEditChallenge();
		challenge.npcTypes = [{ id: createUuid(), name: 'Sentinel', initiativeStat: 2 }];
		await saveChallengeToLibrary(challenge);
		await renderSetup();

		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Remove NPC type Sentinel' }));
		const enemies = screen.getByRole('group', { name: 'Enemies' });
		await fireEvent.click(within(enemies).getByRole('button', { name: 'Add NPC' }));
		expect(within(enemies).getByRole('group', { name: 'NPC Type 1 1' })).toBeTruthy();

		vi.spyOn(window, 'confirm').mockReturnValue(true);
		await fireEvent.click(screen.getByRole('button', { name: 'Remove NPC type NPC Type 1' }));
		expect(
			(within(enemies).getByRole('button', { name: 'Add NPC' }) as HTMLButtonElement).disabled
		).toBe(true);
		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0]!;
			expect(saved.npcTypes).toEqual([]);
			expect(saved.creatures).toHaveLength(1);
			expect(saved.runState?.spawnEdit?.newNpcTypeIds).toEqual([]);
			expect(saved.runState?.spawnEdit?.newCreatureIds).toEqual([]);
			expect(saved.runState?.spawnEdit?.newTurnIds).toEqual([]);
		});
	});

	it('rejects adding across factions when it would invalidate a locked blank identifier', async () => {
		const challenge = createSpawnEditChallenge();
		const npcTypeId = createUuid();
		challenge.npcTypes = [{ id: npcTypeId, name: 'Sentinel', initiativeStat: 2 }];
		challenge.creatures.push({
			id: createUuid(),
			kind: 'npc',
			creatureTypeId: npcTypeId,
			identifier: '',
			factionId: challenge.factions[1]!.id,
			isHidden: false,
			turns: []
		});
		await saveChallengeToLibrary(challenge);
		await renderSetup();

		const players = screen.getByRole('group', { name: 'Players' });
		await fireEvent.click(within(players).getByRole('button', { name: 'Add NPC' }));
		expect(screen.getByRole('alert').textContent).toMatch(
			/blank identifier.*remove.*recreate|choose another type/i
		);
		await waitFor(async () =>
			expect((await loadChallengeLibrary()).challenges[0]!.creatures).toHaveLength(2)
		);
	});

	it('does not change a new NPC type to one with a locked blank identifier', async () => {
		const challenge = createSpawnEditChallenge();
		const lockedNpcTypeId = createUuid();
		const editableNpcTypeId = createUuid();
		const editableNpcId = createUuid();
		const editableTurnId = createUuid();
		challenge.npcTypes = [
			{ id: lockedNpcTypeId, name: 'Sentinel', initiativeStat: 2 },
			{ id: editableNpcTypeId, name: 'Scout', initiativeStat: 1 }
		];
		challenge.creatures.push(
			{
				id: createUuid(),
				kind: 'npc',
				creatureTypeId: lockedNpcTypeId,
				identifier: '',
				factionId: challenge.factions[1]!.id,
				isHidden: false,
				turns: []
			},
			{
				id: editableNpcId,
				kind: 'npc',
				creatureTypeId: editableNpcTypeId,
				identifier: '1',
				factionId: challenge.factions[0]!.id,
				isHidden: false,
				turns: [{ id: editableTurnId, initiative: { kind: 'roll', mode: 'app' } }]
			}
		);
		challenge.runState!.spawnEdit = {
			newCreatureIds: [editableNpcId],
			newNpcTypeIds: [],
			newTurnIds: [editableTurnId],
			lockedInitiativeTurnIds: challenge.runState!.spawnEdit!.lockedInitiativeTurnIds
		};
		await saveChallengeToLibrary(challenge);
		await renderSetup();

		const scout = screen.getByRole('group', { name: 'Scout 1' });
		await fireEvent.change(within(scout).getByRole('combobox', { name: 'NPC type for Scout 1' }), {
			target: { value: lockedNpcTypeId }
		});
		expect(screen.getByRole('alert').textContent).toMatch(/locked NPC with a blank identifier/i);
		expect(
			(within(scout).getByRole('combobox', { name: 'NPC type for Scout 1' }) as HTMLSelectElement)
				.value
		).toBe(editableNpcTypeId);
		await waitFor(async () =>
			expect(
				(await loadChallengeLibrary()).challenges[0]!.creatures.find(
					(creature) => creature.id === editableNpcId
				)
			).toMatchObject({ creatureTypeId: editableNpcTypeId, identifier: '1' })
		);
	});

	it('normalizes a blank identifier only when the existing NPC is editable', async () => {
		const challenge = createSpawnEditChallenge();
		const npcTypeId = createUuid();
		const npcId = createUuid();
		challenge.npcTypes = [{ id: npcTypeId, name: 'Sentinel', initiativeStat: 2 }];
		challenge.creatures.push({
			id: npcId,
			kind: 'npc',
			creatureTypeId: npcTypeId,
			identifier: '',
			factionId: challenge.factions[1]!.id,
			isHidden: false,
			turns: []
		});
		challenge.runState!.spawnEdit = {
			newCreatureIds: [npcId],
			newNpcTypeIds: [npcTypeId],
			newTurnIds: [],
			lockedInitiativeTurnIds: challenge.runState!.spawnEdit!.lockedInitiativeTurnIds
		};
		await saveChallengeToLibrary(challenge);
		await renderSetup();

		const players = screen.getByRole('group', { name: 'Players' });
		await fireEvent.click(within(players).getByRole('button', { name: 'Add NPC' }));
		expect(screen.getByRole('group', { name: 'Sentinel 1' })).toBeTruthy();
		expect(within(players).getByRole('group', { name: 'Sentinel 2' })).toBeTruthy();
		expect(screen.queryByRole('region', { name: 'Setup validation errors' })).toBeNull();
	});

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
		expect(removeNpcTypeButton.getAttribute('title')).toBe('Remove NPC type');
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
