import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { saveChallengeToLibrary, type StableId } from '#lib/challenge';
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

describe('initiative faction section', () => {
	it('collects every manual-roll turn with its creature, turn, saved value, and faction color', async () => {
		const challenge = createSetupChallenge();
		const npcTypeId = '00000000-0000-4000-8000-000000000005' as StableId;
		const manualCharacterTurnId = '00000000-0000-4000-8000-000000000006' as StableId;
		const appCharacterTurnId = '00000000-0000-4000-8000-000000000007' as StableId;
		const emptyCharacterTurnId = '00000000-0000-4000-8000-000000000008' as StableId;
		const manualNpcTurnId = '00000000-0000-4000-8000-000000000009' as StableId;
		const appNpcTurnId = '00000000-0000-4000-8000-000000000010' as StableId;
		const singleTurnId = '00000000-0000-4000-8000-000000000014' as StableId;
		challenge.name = 'Manual collection';
		challenge.factions.push(
			{ id: '00000000-0000-4000-8000-000000000016' as StableId, name: 'Static', color: 'green' },
			{ id: '00000000-0000-4000-8000-000000000017' as StableId, name: 'Empty', color: 'amber' }
		);
		challenge.npcTypes = [{ id: npcTypeId, name: 'Sentinel', initiativeStat: 2 }];
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [
					{ id: manualCharacterTurnId, initiative: { kind: 'roll', mode: 'manual' } },
					{ id: appCharacterTurnId, initiative: { kind: 'roll', mode: 'app' } },
					{ id: emptyCharacterTurnId, initiative: { kind: 'roll', mode: 'manual' } },
					{
						id: '00000000-0000-4000-8000-000000000020' as StableId,
						initiative: { kind: 'static', value: 10 }
					}
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
					{ id: manualNpcTurnId, initiative: { kind: 'roll', mode: 'manual' } },
					{ id: appNpcTurnId, initiative: { kind: 'roll', mode: 'app' } }
				]
			},
			{
				id: '00000000-0000-4000-8000-000000000015' as StableId,
				kind: 'character',
				name: 'Rook',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [{ id: singleTurnId, initiative: { kind: 'roll', mode: 'manual' } }]
			},
			{
				id: '00000000-0000-4000-8000-000000000018' as StableId,
				kind: 'character',
				name: 'Sage',
				factionId: '00000000-0000-4000-8000-000000000016' as StableId,
				isHidden: false,
				turns: [
					{
						id: '00000000-0000-4000-8000-000000000019' as StableId,
						initiative: { kind: 'static', value: 10 }
					}
				]
			}
		];
		challenge.runState = {
			initiativeResults: {
				[manualCharacterTurnId]: 18,
				[appCharacterTurnId]: 12,
				[manualNpcTurnId]: 7
			}
		};
		await saveChallengeToLibrary(challenge);

		render(rollChallengePage);

		const characterInput = (await screen.findByRole('spinbutton', {
			name: 'Initiative for Aria - Turn 1'
		})) as HTMLInputElement;
		const emptyInput = screen.getByRole('spinbutton', {
			name: 'Initiative for Aria - Turn 3'
		}) as HTMLInputElement;
		const npcInput = screen.getByRole('spinbutton', {
			name: 'Initiative for Sentinel B - Turn 1'
		}) as HTMLInputElement;
		const singleTurnInput = screen.getByRole('spinbutton', {
			name: 'Initiative for Rook'
		}) as HTMLInputElement;
		expect(
			screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent?.trim())
		).toEqual(['Players', 'Enemies']);
		expect(screen.queryByRole('region', { name: 'Static' })).toBeNull();
		expect(screen.queryByRole('region', { name: 'Empty' })).toBeNull();
		expect(
			screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent?.trim())
		).toEqual([
			'Aria - Turn 1',
			'Aria - Turn 2',
			'Aria - Turn 3',
			'Rook',
			'Sentinel B - Turn 1',
			'Sentinel B - Turn 2'
		]);
		expect(screen.queryByRole('heading', { name: 'Aria - Turn 4' })).toBeNull();
		expect(screen.queryByRole('heading', { name: 'Sage' })).toBeNull();
		const enemies = screen.getByRole('region', { name: 'Enemies' });
		expect(
			within(enemies).getByRole('spinbutton', { name: 'Initiative for Sentinel B - Turn 1' })
		).toBeTruthy();
		expect(within(enemies).queryByRole('spinbutton', { name: 'Initiative for Rook' })).toBeNull();

		expect(characterInput.value).toBe('18');
		expect(emptyInput.value).toBe('');
		expect(npcInput.value).toBe('7');
		expect(singleTurnInput.value).toBe('');
		expect(screen.queryByRole('spinbutton', { name: 'Initiative for Rook - Turn 1' })).toBeNull();
		expect(screen.queryByRole('spinbutton', { name: 'Initiative for Aria - Turn 2' })).toBeNull();
		expect(
			screen.queryByRole('spinbutton', { name: 'Initiative for Sentinel B - Turn 2' })
		).toBeNull();
		expect(screen.getByText('Initiative result: 12')).toBeTruthy();
		await fireEvent.input(characterInput, { target: { value: '0' } });
		expect(characterInput.value).toBe('0');
		expect(screen.getByText('Initiative result: 12')).toBeTruthy();
		await fireEvent.input(characterInput, { target: { value: '19' } });
		expect(screen.getByText('Initiative is above 18.')).toBeTruthy();
		expect(characterInput.classList.contains('form-control--warning')).toBe(true);
		await fireEvent.input(characterInput, { target: { value: '' } });
		expect(characterInput.value).toBe('');
		expect(characterInput.classList.contains('form-control--warning')).toBe(false);
		expect(screen.getByText('Initiative result: 12')).toBeTruthy();
		await fireEvent.input(emptyInput, { target: { value: '21' } });
		expect(emptyInput.value).toBe('21');
		expect(emptyInput.classList.contains('form-control--warning')).toBe(true);
		expect(screen.getByText('Initiative is above 18.')).toBeTruthy();
		await fireEvent.input(npcInput, { target: { value: '20' } });
		expect(screen.getAllByText('Initiative is above 18.')).toHaveLength(2);
		await fireEvent.input(emptyInput, { target: { value: 'not-a-number' } });
		expect(emptyInput.value).toBe('');
		expect(emptyInput.classList.contains('form-control--warning')).toBe(false);
		expect(screen.getAllByText('Initiative is above 18.')).toHaveLength(1);
		await fireEvent.input(emptyInput, { target: { value: '1.5' } });
		expect(emptyInput.value).toBe('1.5');
		expect(emptyInput.classList.contains('form-control--invalid')).toBe(true);
		expect(screen.getAllByText('Initiative is above 18.')).toHaveLength(1);
		await fireEvent.input(npcInput, { target: { value: '-1' } });
		expect(npcInput.classList.contains('form-control--invalid')).toBe(true);
		expect(screen.queryByText('Initiative is above 18.')).toBeNull();
		await fireEvent.input(characterInput, { target: { value: '' } });
		expect(characterInput.value).toBe('');
		expect(characterInput.classList.contains('form-control--invalid')).toBe(false);
		expect(screen.getByText('Initiative result: 12')).toBeTruthy();

		const cardTints = [...document.querySelectorAll<HTMLElement>('.initiative-card-tone')].map(
			(card) => card.style.getPropertyValue('--faction-color')
		);
		expect(cardTints).toEqual([
			'light-dark(#1f5fbf, #5c9dff)',
			'light-dark(#1f5fbf, #5c9dff)',
			'light-dark(#1f5fbf, #5c9dff)',
			'light-dark(#1f5fbf, #5c9dff)',
			'light-dark(#d32f2f, #ff6b6b)',
			'light-dark(#d32f2f, #ff6b6b)'
		]);
	});
});
