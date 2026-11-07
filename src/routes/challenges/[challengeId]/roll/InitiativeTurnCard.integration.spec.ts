import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import {
	saveChallengeToLibrary,
	loadChallengeLibrary,
	type GeneratedTurnOrder,
	type StableId
} from '#lib/challenge';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import rollChallengePage from '../RollPanel.svelte';
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

describe('initiative turn card', () => {
	it('rolls and rerolls app turns by their initiative stats and restores results', async () => {
		const challenge = createSetupChallenge();
		const npcTypeId = '00000000-0000-4000-8000-000000000005' as StableId;
		const characterTurnId = '00000000-0000-4000-8000-000000000006' as StableId;
		const savedCharacterTurnId = '00000000-0000-4000-8000-000000000007' as StableId;
		const manualTurnId = '00000000-0000-4000-8000-000000000008' as StableId;
		const firstNpcTurnId = '00000000-0000-4000-8000-000000000009' as StableId;
		const secondNpcTurnId = '00000000-0000-4000-8000-000000000010' as StableId;
		const generatedTurnOrder: GeneratedTurnOrder = [
			{ kind: 'turn', turnId: savedCharacterTurnId },
			{ kind: 'turn', turnId: manualTurnId },
			{ kind: 'spawn' }
		];
		challenge.npcTypes = [{ id: npcTypeId, name: 'Sentinel', initiativeStat: 3 }];
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				initiativeStat: 2,
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [
					{ id: characterTurnId, initiative: { kind: 'roll', mode: 'app' } },
					{ id: savedCharacterTurnId, initiative: { kind: 'roll', mode: 'app' } },
					{ id: manualTurnId, initiative: { kind: 'roll', mode: 'manual' } }
				]
			},
			{
				id: '00000000-0000-4000-8000-000000000012' as StableId,
				kind: 'npc',
				creatureTypeId: npcTypeId,
				identifier: 'B',
				factionId: '00000000-0000-4000-8000-000000000003' as StableId,
				isHidden: true,
				turns: [
					{ id: firstNpcTurnId, initiative: { kind: 'roll', mode: 'app' } },
					{ id: secondNpcTurnId, initiative: { kind: 'roll', mode: 'app' } }
				]
			}
		];
		challenge.runState = {
			initiativeResults: { [savedCharacterTurnId]: 16, [manualTurnId]: 8 },
			generatedTurnOrder
		};
		await saveChallengeToLibrary(challenge);
		vi.spyOn(Math, 'random')
			.mockReturnValueOnce(0)
			.mockReturnValueOnce(0.99)
			.mockReturnValueOnce(0)
			.mockReturnValueOnce(0.2)
			.mockReturnValueOnce(0.4)
			.mockReturnValueOnce(0.99)
			.mockReturnValueOnce(0.5)
			.mockReturnValueOnce(0)
			.mockReturnValueOnce(0)
			.mockReturnValueOnce(0.99);

		const firstView = render(rollChallengePage);
		await fireEvent.click(
			await screen.findByRole('button', { name: 'Roll initiative for Aria - Turn 1' })
		);
		expect(screen.getByText('Initiative result: 7')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Roll initiative for Aria - Turn 1' })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Roll all' }));
		expect(screen.getByText('Initiative result: 6')).toBeTruthy();
		expect(screen.getByText('Initiative result: 11')).toBeTruthy();
		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.generatedTurnOrder).toBeUndefined();
		});
		await fireEvent.click(
			screen.getByRole('button', { name: 'Reroll initiative for Aria - Turn 2' })
		);
		expect(screen.getAllByText('Initiative result: 7')).toHaveLength(2);

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.initiativeResults).toEqual({
				[characterTurnId]: 7,
				[savedCharacterTurnId]: 7,
				[manualTurnId]: 8,
				[firstNpcTurnId]: 6,
				[secondNpcTurnId]: 11
			});
			expect(saved?.runState?.generatedTurnOrder).toBeUndefined();
		});

		firstView.unmount();
		render(rollChallengePage);
		expect(await screen.findAllByText('Initiative result: 7')).toHaveLength(2);
		expect(screen.getByText('Initiative result: 6')).toBeTruthy();
		expect(screen.getByText('Initiative result: 11')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Roll all' })).toBeNull();
	});

	it('blocks an app roll when its character has no valid initiative stat', async () => {
		const challenge = createSetupChallenge();
		const turnId = '00000000-0000-4000-8000-000000000006' as StableId;
		const savedTurnId = '00000000-0000-4000-8000-000000000007' as StableId;
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [
					{ id: turnId, initiative: { kind: 'roll', mode: 'app' } },
					{ id: savedTurnId, initiative: { kind: 'roll', mode: 'app' } }
				]
			}
		];
		challenge.runState = { initiativeResults: { [savedTurnId]: 10 } };
		await saveChallengeToLibrary(challenge);

		render(rollChallengePage);

		const rollButton = (await screen.findByRole('button', {
			name: 'Roll initiative for Aria - Turn 1'
		})) as HTMLButtonElement;
		expect(rollButton.disabled).toBe(true);
		const rerollButton = (await screen.findByRole('button', {
			name: 'Reroll initiative for Aria - Turn 2'
		})) as HTMLButtonElement;
		expect(rerollButton.disabled).toBe(true);
		expect(
			screen.getAllByText('Cannot roll because the initiative stat is missing or invalid.')
		).toHaveLength(2);
		expect(screen.getByText('Initiative result: 10')).toBeTruthy();
	});
});
