import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import rollChallengePage from './RollPanel.svelte';
import { saveChallengeToLibrary, loadChallengeLibrary, type StableId } from '#lib/challenge';
import { createSetupChallenge, expectPageError } from '../../view-test-support';

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

describe('running challenge view', () => {
	it('has a heading and a link back to the landing page', async () => {
		render(rollChallengePage);

		expect(
			await screen.findByRole('heading', { level: 1, name: 'Initiative rolling' })
		).toBeTruthy();
	});
});

describe('running challenge storage', () => {
	it('shows the challenge name loaded from IndexedDB', async () => {
		await saveChallengeToLibrary({ ...createSetupChallenge(), name: 'Ashen Company' });

		render(rollChallengePage);

		expect(await screen.findByText('Ashen Company')).toBeTruthy();
		expect(screen.getByRole('heading', { name: 'Initiative rolling' })).toBeTruthy();
		expect(document.title).toBe('Initiative rolling | Soulstone Initiative Tracker');
	});

	it('disables initiative edits and tie decisions while the challenge is running', async () => {
		const challenge = createSetupChallenge();
		const [manualOne, manualTwo, appResult, appPending] = [6, 7, 8, 9].map(
			(id) => `00000000-0000-4000-8000-00000000000${id}` as StableId
		);
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				initiativeStat: 2,
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [
					{ id: manualOne, initiative: { kind: 'roll', mode: 'manual' } },
					{ id: manualTwo, initiative: { kind: 'roll', mode: 'manual' } },
					{ id: appResult, initiative: { kind: 'roll', mode: 'app' } },
					{ id: appPending, initiative: { kind: 'roll', mode: 'app' } }
				]
			}
		];
		challenge.runState = {
			initiativeResults: { [manualOne]: 5, [manualTwo]: 5, [appResult]: 9 },
			generatedTurnOrder: [
				{ kind: 'turn', turnId: manualOne },
				{ kind: 'turn', turnId: manualTwo },
				{ kind: 'turn', turnId: appResult },
				{ kind: 'turn', turnId: appPending },
				{ kind: 'spawn' }
			]
		};
		await saveChallengeToLibrary(challenge);

		render(rollChallengePage);

		const manualInput = (await screen.findByRole('spinbutton', {
			name: 'Initiative for Aria - Turn 1'
		})) as HTMLInputElement;
		expect(manualInput.matches(':disabled')).toBe(true);
		expect(
			(
				screen.getByRole('button', {
					name: 'Reroll initiative for Aria - Turn 3'
				}) as HTMLButtonElement
			).matches(':disabled')
		).toBe(true);
		expect(
			(
				screen.getByRole('button', {
					name: 'Roll initiative for Aria - Turn 4'
				}) as HTMLButtonElement
			).matches(':disabled')
		).toBe(true);
		expect(
			(screen.getByRole('button', { name: 'Roll all remaining' }) as HTMLButtonElement).matches(
				':disabled'
			)
		).toBe(true);
		expect(
			(
				screen.getByRole('button', { name: 'Move Aria - Turn 2 earlier' }) as HTMLButtonElement
			).matches(':disabled')
		).toBe(true);
		await fireEvent.input(manualInput, { target: { value: '14' } });

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.initiativeResults[manualOne]).toBe(5);
			expect(saved?.runState?.generatedTurnOrder).toHaveLength(5);
		});
	});

	it('persists initiative edits, restores them on reload, and saves cleared results', async () => {
		const challenge = createSetupChallenge();
		const firstTurnId = '00000000-0000-4000-8000-000000000006' as StableId;
		const secondTurnId = '00000000-0000-4000-8000-000000000007' as StableId;
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [
					{ id: firstTurnId, initiative: { kind: 'roll', mode: 'manual' } },
					{ id: secondTurnId, initiative: { kind: 'roll', mode: 'manual' } }
				]
			}
		];
		challenge.runState = {
			initiativeResults: { [secondTurnId]: 8 }
		};
		await saveChallengeToLibrary(challenge);

		const firstView = render(rollChallengePage);
		const firstInput = (await screen.findByRole('spinbutton', {
			name: 'Initiative for Aria - Turn 1'
		})) as HTMLInputElement;
		await fireEvent.input(firstInput, { target: { value: '14' } });

		await waitFor(async () => {
			const library = await loadChallengeLibrary();
			const saved = library.challenges[0];
			expect(saved?.runState?.initiativeResults[firstTurnId]).toBe(14);
			expect(saved?.runState?.initiativeResults[secondTurnId]).toBe(8);
			expect(saved?.runState?.generatedTurnOrder).toBeUndefined();
			expect(saved?.creatures[0]).toMatchObject({ name: 'Aria' });
		});

		firstView.unmount();
		render(rollChallengePage);
		const restoredInput = (await screen.findByRole('spinbutton', {
			name: 'Initiative for Aria - Turn 1'
		})) as HTMLInputElement;
		expect(restoredInput.value).toBe('14');

		await fireEvent.input(restoredInput, { target: { value: '' } });
		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.initiativeResults[firstTurnId]).toBeUndefined();
			expect(saved?.runState?.initiativeResults[secondTurnId]).toBe(8);
			expect(saved?.runState?.generatedTurnOrder).toBeUndefined();
		});
	});

	it('saves the latest initiative before returning to setup', async () => {
		const challenge = createSetupChallenge();
		const turnId = '00000000-0000-4000-8000-000000000006' as StableId;
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [{ id: turnId, initiative: { kind: 'roll', mode: 'manual' } }]
			}
		];
		await saveChallengeToLibrary(challenge);

		render(rollChallengePage);
		const input = await screen.findByRole('spinbutton', { name: 'Initiative for Aria' });
		await fireEvent.input(input, { target: { value: '12' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Return to setup' }));

		await waitFor(async () => {
			expect(
				(await loadChallengeLibrary()).challenges[0]?.runState?.initiativeResults[turnId]
			).toBe(12);
		});
		expect(mockedGoto).not.toHaveBeenCalled();
		expect((await loadChallengeLibrary()).challenges[0]?.runState?.initiativeResults[turnId]).toBe(
			12
		);
	});

	it('saves the latest initiative before continuing to turn order', async () => {
		const challenge = createSetupChallenge();
		const turnId = '00000000-0000-4000-8000-000000000006' as StableId;
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [{ id: turnId, initiative: { kind: 'roll', mode: 'manual' } }]
			}
		];
		await saveChallengeToLibrary(challenge);

		render(rollChallengePage);
		const input = await screen.findByRole('spinbutton', { name: 'Initiative for Aria' });
		await fireEvent.input(input, { target: { value: '12' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Continue to turn order' }));

		await waitFor(async () => {
			expect(
				(await loadChallengeLibrary()).challenges[0]?.runState?.initiativeResults[turnId]
			).toBe(12);
		});
		expect(mockedGoto).not.toHaveBeenCalled();
		expect((await loadChallengeLibrary()).challenges[0]?.runState?.initiativeResults[turnId]).toBe(
			12
		);
	});

	it('shows a save error and stays on the roll page when persistence fails', async () => {
		const challenge = createSetupChallenge();
		const turnId = '00000000-0000-4000-8000-000000000006' as StableId;
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [{ id: turnId, initiative: { kind: 'roll', mode: 'manual' } }]
			}
		];
		await saveChallengeToLibrary(challenge);

		render(rollChallengePage);
		const input = await screen.findByRole('spinbutton', { name: 'Initiative for Aria' });
		vi.stubGlobal('indexedDB', undefined);
		await fireEvent.input(input, { target: { value: '12' } });

		await screen.findByRole('alert');
		expectPageError('Changes could not be saved.');
		await fireEvent.click(screen.getByRole('button', { name: 'Return to setup' }));
		expect(mockedGoto).not.toHaveBeenCalled();
	});

	it('does not continue to turn order when saving pending edits fails', async () => {
		const challenge = createSetupChallenge();
		const turnId = '00000000-0000-4000-8000-000000000006' as StableId;
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [{ id: turnId, initiative: { kind: 'roll', mode: 'manual' } }]
			}
		];
		await saveChallengeToLibrary(challenge);

		render(rollChallengePage);
		const input = await screen.findByRole('spinbutton', { name: 'Initiative for Aria' });
		vi.stubGlobal('indexedDB', undefined);
		await fireEvent.input(input, { target: { value: '12' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Continue to turn order' }));

		await screen.findByRole('alert');
		expectPageError('Changes could not be saved.');
		expect(mockedGoto).not.toHaveBeenCalled();
	});

	it('offers a return-to-setup action for the loaded challenge', async () => {
		render(rollChallengePage);

		expect(await screen.findByRole('button', { name: 'Return to setup' })).toBeTruthy();
	});

	it.each([
		{ kind: 'unknown', message: 'The challenge was not found.' },
		{ kind: 'unreadable', message: 'The challenge could not be loaded.' }
	] as const)(
		'explains an $kind challenge and offers landing-page recovery',
		async ({ kind, message }) => {
			if (kind === 'unknown') {
				mockedPage.params = { challengeId: '00000000-0000-4000-8000-000000000099' };
			} else {
				vi.stubGlobal('indexedDB', undefined);
			}

			render(rollChallengePage);

			await screen.findByRole('alert');
			expectPageError(message);
			expect(await screen.findByRole('heading', { name: 'Initiative rolling' })).toBeTruthy();
			expect(document.title).toBe('Initiative rolling | Soulstone Initiative Tracker');
			expect(screen.getByRole('link', { name: 'Return to challenges' }).getAttribute('href')).toBe(
				'/challenges'
			);
		}
	);
});

describe('running challenge storage', () => {
	it('shows the challenge name loaded from IndexedDB', async () => {
		await saveChallengeToLibrary({ ...createSetupChallenge(), name: 'Ashen Company' });

		render(rollChallengePage);

		expect(await screen.findByText('Ashen Company')).toBeTruthy();
		expect(screen.getByRole('heading', { name: 'Initiative rolling' })).toBeTruthy();
		expect(document.title).toBe('Initiative rolling | Soulstone Initiative Tracker');
	});

	it('persists initiative edits, restores them on reload, and saves cleared results', async () => {
		const challenge = createSetupChallenge();
		const firstTurnId = '00000000-0000-4000-8000-000000000006' as StableId;
		const secondTurnId = '00000000-0000-4000-8000-000000000007' as StableId;
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [
					{ id: firstTurnId, initiative: { kind: 'roll', mode: 'manual' } },
					{ id: secondTurnId, initiative: { kind: 'roll', mode: 'manual' } }
				]
			}
		];
		challenge.runState = {
			initiativeResults: { [secondTurnId]: 8 }
		};
		await saveChallengeToLibrary(challenge);

		const firstView = render(rollChallengePage);
		const firstInput = (await screen.findByRole('spinbutton', {
			name: 'Initiative for Aria - Turn 1'
		})) as HTMLInputElement;
		await fireEvent.input(firstInput, { target: { value: '14' } });

		await waitFor(async () => {
			const library = await loadChallengeLibrary();
			const saved = library.challenges[0];
			expect(saved?.runState?.initiativeResults[firstTurnId]).toBe(14);
			expect(saved?.runState?.initiativeResults[secondTurnId]).toBe(8);
			expect(saved?.runState?.generatedTurnOrder).toBeUndefined();
			expect(saved?.creatures[0]).toMatchObject({ name: 'Aria' });
		});

		firstView.unmount();
		render(rollChallengePage);
		const restoredInput = (await screen.findByRole('spinbutton', {
			name: 'Initiative for Aria - Turn 1'
		})) as HTMLInputElement;
		expect(restoredInput.value).toBe('14');

		await fireEvent.input(restoredInput, { target: { value: '' } });
		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.initiativeResults[firstTurnId]).toBeUndefined();
			expect(saved?.runState?.initiativeResults[secondTurnId]).toBe(8);
			expect(saved?.runState?.generatedTurnOrder).toBeUndefined();
		});
	});

	it('saves the latest initiative before returning to setup', async () => {
		const challenge = createSetupChallenge();
		const turnId = '00000000-0000-4000-8000-000000000006' as StableId;
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [{ id: turnId, initiative: { kind: 'roll', mode: 'manual' } }]
			}
		];
		await saveChallengeToLibrary(challenge);

		render(rollChallengePage);
		const input = await screen.findByRole('spinbutton', { name: 'Initiative for Aria' });
		await fireEvent.input(input, { target: { value: '12' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Return to setup' }));

		expect(mockedGoto).not.toHaveBeenCalled();
		await waitFor(async () => {
			expect(
				(await loadChallengeLibrary()).challenges[0]?.runState?.initiativeResults[turnId]
			).toBe(12);
		});
	});

	it('saves the latest initiative before continuing to turn order', async () => {
		const challenge = createSetupChallenge();
		const turnId = '00000000-0000-4000-8000-000000000006' as StableId;
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [{ id: turnId, initiative: { kind: 'roll', mode: 'manual' } }]
			}
		];
		await saveChallengeToLibrary(challenge);

		render(rollChallengePage);
		const input = await screen.findByRole('spinbutton', { name: 'Initiative for Aria' });
		await fireEvent.input(input, { target: { value: '12' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Continue to turn order' }));

		expect(mockedGoto).not.toHaveBeenCalled();
		await waitFor(async () => {
			expect(
				(await loadChallengeLibrary()).challenges[0]?.runState?.initiativeResults[turnId]
			).toBe(12);
		});
	});

	it('shows a save error and stays on the roll page when persistence fails', async () => {
		const challenge = createSetupChallenge();
		const turnId = '00000000-0000-4000-8000-000000000006' as StableId;
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [{ id: turnId, initiative: { kind: 'roll', mode: 'manual' } }]
			}
		];
		await saveChallengeToLibrary(challenge);

		render(rollChallengePage);
		const input = await screen.findByRole('spinbutton', { name: 'Initiative for Aria' });
		vi.stubGlobal('indexedDB', undefined);
		await fireEvent.input(input, { target: { value: '12' } });

		await screen.findByRole('alert');
		expectPageError('Changes could not be saved.');
		await fireEvent.click(screen.getByRole('button', { name: 'Return to setup' }));
		expect(mockedGoto).not.toHaveBeenCalled();
	});

	it('does not continue to turn order when saving pending edits fails', async () => {
		const challenge = createSetupChallenge();
		const turnId = '00000000-0000-4000-8000-000000000006' as StableId;
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [{ id: turnId, initiative: { kind: 'roll', mode: 'manual' } }]
			}
		];
		await saveChallengeToLibrary(challenge);

		render(rollChallengePage);
		const input = await screen.findByRole('spinbutton', { name: 'Initiative for Aria' });
		vi.stubGlobal('indexedDB', undefined);
		await fireEvent.input(input, { target: { value: '12' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Continue to turn order' }));

		await screen.findByRole('alert');
		expectPageError('Changes could not be saved.');
		expect(mockedGoto).not.toHaveBeenCalled();
	});

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
		const characterField = within(characterInput.closest('.initiative-field') as HTMLElement);
		const emptyField = within(emptyInput.closest('.initiative-field') as HTMLElement);
		const npcField = within(npcInput.closest('.initiative-field') as HTMLElement);
		for (const field of document.querySelectorAll<HTMLElement>('.initiative-field')) {
			expect(field.textContent).not.toMatch(/Aria|Rook|Sentinel B/);
		}
		expect(screen.getAllByText('Initiative', { selector: 'label > span' })).toHaveLength(4);
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
		expect(characterField.getByText('Initiative is above 18.')).toBeTruthy();
		expect(characterInput.classList.contains('form-control--warning')).toBe(true);
		await fireEvent.input(characterInput, { target: { value: '' } });
		expect(characterInput.value).toBe('');
		expect(characterInput.classList.contains('form-control--warning')).toBe(false);
		expect(screen.getByText('Initiative result: 12')).toBeTruthy();
		await fireEvent.input(emptyInput, { target: { value: '21' } });
		expect(emptyInput.value).toBe('21');
		expect(emptyInput.classList.contains('form-control--warning')).toBe(true);
		expect(emptyField.getByText('Initiative is above 18.')).toBeTruthy();
		await fireEvent.input(npcInput, { target: { value: '20' } });
		expect(npcField.getByText('Initiative is above 18.')).toBeTruthy();
		await fireEvent.input(emptyInput, { target: { value: 'not-a-number' } });
		expect(emptyInput.value).toBe('');
		expect(emptyInput.classList.contains('form-control--warning')).toBe(false);
		expect(emptyField.queryByText('Initiative is above 18.')).toBeNull();
		expect(npcField.getByText('Initiative is above 18.')).toBeTruthy();
		await fireEvent.input(emptyInput, { target: { value: '1.5' } });
		expect(emptyInput.value).toBe('1.5');
		expect(emptyInput.classList.contains('form-control--invalid')).toBe(true);
		expect(emptyField.queryByText('Initiative is above 18.')).toBeNull();
		expect(npcField.getByText('Initiative is above 18.')).toBeTruthy();
		await fireEvent.input(npcInput, { target: { value: '-1' } });
		expect(npcInput.classList.contains('form-control--invalid')).toBe(true);
		expect(npcField.queryByText('Initiative is above 18.')).toBeNull();
		await fireEvent.input(characterInput, { target: { value: '' } });
		expect(characterInput.value).toBe('');
		expect(characterInput.classList.contains('form-control--invalid')).toBe(false);
		expect(screen.getByText('Initiative result: 12')).toBeTruthy();

		const cardTints = [...document.querySelectorAll<HTMLElement>('.initiative-card-tone')].map(
			(card) => card.style.getPropertyValue('--faction-color')
		);
		expect(cardTints).toEqual(['#5687c8', '#5687c8', '#5687c8', '#5687c8', '#c76a6e', '#c76a6e']);
	});

	it('rolls and rerolls app turns by their initiative stats and restores results', async () => {
		const challenge = createSetupChallenge();
		const npcTypeId = '00000000-0000-4000-8000-000000000005' as StableId;
		const characterTurnId = '00000000-0000-4000-8000-000000000006' as StableId;
		const savedCharacterTurnId = '00000000-0000-4000-8000-000000000007' as StableId;
		const manualTurnId = '00000000-0000-4000-8000-000000000008' as StableId;
		const firstNpcTurnId = '00000000-0000-4000-8000-000000000009' as StableId;
		const secondNpcTurnId = '00000000-0000-4000-8000-000000000010' as StableId;
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
			initiativeResults: { [savedCharacterTurnId]: 16, [manualTurnId]: 8 }
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
		await fireEvent.click(screen.getByRole('button', { name: 'Roll all remaining' }));
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
		expect(screen.queryByRole('button', { name: 'Roll all remaining' })).toBeNull();
	});

	it('rolls zero-stat creatures as 0 without randomness and surfaces the tie', async () => {
		const challenge = createSetupChallenge();
		const npcTypeId = '00000000-0000-4000-8000-000000000005' as StableId;
		const characterTurnId = '00000000-0000-4000-8000-000000000006' as StableId;
		const npcTurnId = '00000000-0000-4000-8000-000000000009' as StableId;
		const faction = '00000000-0000-4000-8000-000000000002' as StableId;
		challenge.npcTypes = [{ id: npcTypeId, name: 'Sentinel', initiativeStat: 0 }];
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				initiativeStat: 0,
				factionId: faction,
				isHidden: false,
				turns: [{ id: characterTurnId, initiative: { kind: 'roll', mode: 'app' } }]
			},
			{
				id: '00000000-0000-4000-8000-000000000012' as StableId,
				kind: 'npc',
				creatureTypeId: npcTypeId,
				identifier: 'A',
				factionId: faction,
				isHidden: false,
				turns: [{ id: npcTurnId, initiative: { kind: 'roll', mode: 'app' } }]
			}
		];
		await saveChallengeToLibrary(challenge);
		const random = vi.spyOn(Math, 'random');

		render(rollChallengePage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Roll initiative for Aria' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Roll all remaining' }));

		expect(screen.getAllByText('Initiative result: 0')).toHaveLength(2);
		expect(screen.getByText('Needs ordering')).toBeTruthy();
		expect(random).not.toHaveBeenCalled();
		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.initiativeResults).toEqual({
				[characterTurnId]: 0,
				[npcTurnId]: 0
			});
		});
	});

	it('lets the DM order a tie and saves the decision', async () => {
		const challenge = createSetupChallenge();
		const faction = '00000000-0000-4000-8000-000000000002' as StableId;
		const a = '00000000-0000-4000-8000-000000000036' as StableId;
		const b = '00000000-0000-4000-8000-000000000037' as StableId;
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: faction,
				isHidden: false,
				turns: [a, b].map((id) => ({
					id,
					initiative: { kind: 'roll' as const, mode: 'manual' as const }
				}))
			}
		];
		challenge.runState = {
			initiativeResults: { [a]: 5, [b]: 5 }
		};
		await saveChallengeToLibrary(challenge);

		render(rollChallengePage);
		expect(await screen.findByText('Needs ordering')).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Move Aria - Turn 2 earlier' }));

		expect(screen.getByText('Ordered')).toBeTruthy();
		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.tieDecisions).toEqual([[b, a]]);
			expect(saved?.runState?.generatedTurnOrder).toBeUndefined();
		});
	});

	it('discards tie decisions for a rerolled turn and keeps the others', async () => {
		const challenge = createSetupChallenge();
		const faction = '00000000-0000-4000-8000-000000000002' as StableId;
		const [a, b, c, d] = [6, 7, 8, 9].map(
			(n) => `00000000-0000-4000-8000-00000000003${n}` as StableId
		);
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				initiativeStat: 2,
				factionId: faction,
				isHidden: false,
				turns: [a, b, c, d].map((id) => ({
					id,
					initiative: { kind: 'roll' as const, mode: 'app' as const }
				}))
			}
		];
		challenge.runState = {
			initiativeResults: { [a]: 5, [b]: 5, [c]: 8, [d]: 8 },
			tieDecisions: [
				[b, a],
				[d, c]
			]
		};
		await saveChallengeToLibrary(challenge);
		vi.spyOn(Math, 'random').mockReturnValue(0.5);

		render(rollChallengePage);
		await fireEvent.click(
			await screen.findByRole('button', { name: 'Reroll initiative for Aria - Turn 1' })
		);

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.tieDecisions).toEqual([[d, c]]);
		});
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
		for (const field of document.querySelectorAll<HTMLElement>('.initiative-field')) {
			expect(field.textContent).not.toContain('Aria');
		}
		expect(screen.getByText('Initiative result: 10')).toBeTruthy();
	});

	it('offers a return-to-setup action for the loaded challenge', async () => {
		render(rollChallengePage);

		expect(await screen.findByRole('button', { name: 'Return to setup' })).toBeTruthy();
	});

	it.each([
		{ kind: 'unknown', message: 'The challenge was not found.' },
		{ kind: 'unreadable', message: 'The challenge could not be loaded.' }
	] as const)(
		'explains an $kind challenge and offers landing-page recovery',
		async ({ kind, message }) => {
			if (kind === 'unknown') {
				mockedPage.params = { challengeId: '00000000-0000-4000-8000-000000000099' };
			} else {
				vi.stubGlobal('indexedDB', undefined);
			}

			render(rollChallengePage);

			await screen.findByRole('alert');
			expectPageError(message);
			expect(await screen.findByRole('heading', { name: 'Initiative rolling' })).toBeTruthy();
			expect(document.title).toBe('Initiative rolling | Soulstone Initiative Tracker');
			expect(screen.getByRole('link', { name: 'Return to challenges' }).getAttribute('href')).toBe(
				'/challenges'
			);
		}
	);
});

describe('spawn editing', () => {
	const faction = '00000000-0000-4000-8000-000000000002' as StableId;
	const [lockedManual, missingManual, missingApp, lockedApp] = [41, 42, 43, 44].map(
		(id) => `00000000-0000-4000-8000-0000000000${id}` as StableId
	);

	async function saveEditingChallenge(
		turns: readonly { readonly id: StableId; readonly mode: 'manual' | 'app' }[],
		initiativeResults: Readonly<Record<StableId, number>>,
		extra: {
			readonly tieDecisions?: readonly (readonly StableId[])[];
			readonly newTurnIds?: readonly StableId[];
		} = {}
	): Promise<void> {
		const challenge = createSetupChallenge();
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				initiativeStat: 2,
				factionId: faction,
				isHidden: false,
				turns: turns.map(({ id, mode }) => ({ id, initiative: { kind: 'roll', mode } }))
			}
		];
		challenge.runState = {
			initiativeResults,
			generatedTurnOrder: [{ kind: 'spawn' }],
			spawnCount: 1,
			...(extra.tieDecisions ? { tieDecisions: extra.tieDecisions } : {}),
			spawnEdit: {
				newCreatureIds: [],
				newNpcTypeIds: [],
				newTurnIds: [...(extra.newTurnIds ?? [])],
				lockedInitiativeTurnIds: Object.keys(initiativeResults) as StableId[]
			}
		};
		await saveChallengeToLibrary(challenge);
	}

	function isDisabled(element: Pick<HTMLElement, 'matches'>): boolean {
		return element.matches(':disabled');
	}

	it('locks collected results but lets missing results be collected', async () => {
		await saveEditingChallenge(
			[
				{ id: lockedManual, mode: 'manual' },
				{ id: missingManual, mode: 'manual' },
				{ id: missingApp, mode: 'app' },
				{ id: lockedApp, mode: 'app' }
			],
			{ [lockedManual]: 12, [lockedApp]: 9 } as Record<StableId, number>
		);

		render(rollChallengePage);

		expect(
			isDisabled(await screen.findByRole('spinbutton', { name: 'Initiative for Aria - Turn 1' }))
		).toBe(true);
		expect(
			isDisabled(screen.getByRole('spinbutton', { name: 'Initiative for Aria - Turn 2' }))
		).toBe(false);
		expect(
			isDisabled(screen.getByRole('button', { name: 'Roll initiative for Aria - Turn 3' }))
		).toBe(false);
		expect(
			isDisabled(screen.getByRole('button', { name: 'Reroll initiative for Aria - Turn 4' }))
		).toBe(true);
		expect(
			screen.queryByText('Cannot roll because the initiative stat is missing or invalid.')
		).toBeNull();
		expect(isDisabled(screen.getByRole('button', { name: 'Roll all remaining' }))).toBe(false);
	});

	it('collects multi-digit manual results and keeps the pending Spawn order', async () => {
		await saveEditingChallenge(
			[
				{ id: lockedManual, mode: 'manual' },
				{ id: missingManual, mode: 'manual' }
			],
			{ [lockedManual]: 12 } as Record<StableId, number>
		);

		render(rollChallengePage);
		const input = (await screen.findByRole('spinbutton', {
			name: 'Initiative for Aria - Turn 2'
		})) as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '1' } });
		await fireEvent.input(input, { target: { value: '14' } });
		await fireEvent.input(input, { target: { value: '15' } });
		expect(isDisabled(input)).toBe(false);

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.initiativeResults).toEqual({
				[lockedManual]: 12,
				[missingManual]: 15
			});
			expect(saved?.runState?.generatedTurnOrder).toEqual([{ kind: 'spawn' }]);
			expect(saved?.runState?.spawnCount).toBe(1);
			expect(saved?.runState?.spawnEdit?.lockedInitiativeTurnIds).toEqual([lockedManual]);
		});
	});

	it('locks an app result once rolled and Roll all remaining fills only missing results', async () => {
		await saveEditingChallenge(
			[
				{ id: lockedApp, mode: 'app' },
				{ id: missingApp, mode: 'app' },
				{ id: missingManual, mode: 'app' }
			],
			{ [lockedApp]: 9 } as Record<StableId, number>
		);
		vi.spyOn(Math, 'random').mockReturnValue(0);

		render(rollChallengePage);
		await fireEvent.click(
			await screen.findByRole('button', { name: 'Roll initiative for Aria - Turn 2' })
		);

		expect(
			isDisabled(screen.getByRole('button', { name: 'Reroll initiative for Aria - Turn 2' }))
		).toBe(true);
		await fireEvent.click(screen.getByRole('button', { name: 'Roll all remaining' }));

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.initiativeResults).toEqual({
				[lockedApp]: 9,
				[missingApp]: 2,
				[missingManual]: 2
			});
			expect(saved?.runState?.generatedTurnOrder).toEqual([{ kind: 'spawn' }]);
		});
		expect(
			isDisabled(screen.getByRole('button', { name: 'Reroll initiative for Aria - Turn 3' }))
		).toBe(true);
		expect(screen.queryByRole('button', { name: 'Roll all remaining' })).toBeNull();
	});

	it('resolves ties, keeping valid decisions and discarding affected ones', async () => {
		const [a, b, c, d] = [51, 52, 53, 54].map(
			(id) => `00000000-0000-4000-8000-0000000000${id}` as StableId
		);
		await saveEditingChallenge(
			[
				{ id: a, mode: 'manual' },
				{ id: b, mode: 'manual' },
				{ id: c, mode: 'manual' },
				{ id: d, mode: 'manual' }
			],
			{ [a]: 5, [b]: 5, [c]: 3 } as Record<StableId, number>,
			{ tieDecisions: [[b, a]], newTurnIds: [d] }
		);

		render(rollChallengePage);
		await fireEvent.input(
			await screen.findByRole('spinbutton', { name: 'Initiative for Aria - Turn 4' }),
			{ target: { value: '9' } }
		);
		expect((await loadChallengeLibrary()).challenges[0]?.runState?.tieDecisions).toEqual([[b, a]]);

		await fireEvent.input(
			screen.getByRole('spinbutton', { name: 'Initiative for Aria - Turn 4' }),
			{
				target: { value: '3' }
			}
		);
		await fireEvent.click(
			await screen.findByRole('button', { name: 'Move Aria - Turn 4 earlier' })
		);

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.tieDecisions).toEqual([
				[b, a],
				[d, c]
			]);
			expect(saved?.runState?.generatedTurnOrder).toEqual([{ kind: 'spawn' }]);
		});
	});
});
