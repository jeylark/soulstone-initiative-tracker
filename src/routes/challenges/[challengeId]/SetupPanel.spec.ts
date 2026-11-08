import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import setupChallengePage from './SetupPanel.svelte';
import { saveChallengeToLibrary, loadChallengeLibrary, type StableId } from '#lib/challenge';
import {
	createSetupChallenge,
	renderSetup,
	expectPageError,
	setRelativeTarget
} from '../../view-test-support';

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

describe('challenge setup view', () => {
	it('has a heading and a link back to the landing page', async () => {
		render(setupChallengePage);

		expect(await screen.findByRole('heading', { level: 1, name: 'Challenge setup' })).toBeTruthy();
		expect(document.title).toBe('Challenge setup | Soulstone Initiative Tracker');
	});
});

describe('challenge setup persistence', () => {
	it('loads the challenge from IndexedDB', async () => {
		await saveChallengeToLibrary({ ...createSetupChallenge(), name: 'Stored name' });

		await renderSetup();

		expect(
			(screen.getByRole('textbox', { name: 'Challenge name' }) as HTMLInputElement).value
		).toBe('Stored name');
	});

	it('saves edits to IndexedDB', async () => {
		await renderSetup();

		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'Edited' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.name).toBe('Edited');
			expect(saved?.npcTypes).toHaveLength(1);
		});
	});

	it('autosaves finite invalid values and blocks rolling until corrected', async () => {
		await renderSetup();
		const fairnessInput = screen.getByRole('spinbutton', { name: 'Fairness weight value' });

		await fireEvent.input(fairnessInput, { target: { value: '-1' } });

		await waitFor(async () => {
			expect((await loadChallengeLibrary()).challenges[0]?.fairnessWeight).toBe(-1);
		});
		expect(
			(screen.getByRole('button', { name: 'Roll Initiatives' }) as HTMLButtonElement).disabled
		).toBe(true);
		expect(screen.getByText('Fairness weight must be a non-negative number.')).toBeTruthy();
	});

	it('shows validation messages on the inputs they belong to', async () => {
		await renderSetup();

		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: ' ' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		await fireEvent.input(screen.getByRole('textbox', { name: /^NPC type name/ }), {
			target: { value: '' }
		});

		const challengeName = screen.getByRole('textbox', { name: 'Challenge name' });
		expect(challengeName.getAttribute('aria-invalid')).toBe('true');
		expect(challengeName.getAttribute('aria-describedby')).toBeTruthy();
		expect(screen.getByText('Challenge name must not be blank.')).toBeTruthy();
		const npcTypeName = screen.getByRole('textbox', { name: /^NPC type name/ });
		expect(npcTypeName.getAttribute('aria-invalid')).toBe('true');
		expect(screen.getByText('NPC type name must not be blank.')).toBeTruthy();
		expect(document.querySelector('.setup-validation-issues')).toBeNull();
	});

	it('persists invalid finite placement values in editable drafts', async () => {
		const challenge = createSetupChallenge();
		challenge.name = 'Draft';
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: challenge.factions[0]!.id,
				isHidden: false,
				turns: [
					{
						id: '00000000-0000-4000-8000-000000000006' as StableId,
						initiative: { kind: 'roll', mode: 'manual' }
					}
				]
			}
		];
		await saveChallengeToLibrary(challenge);
		await renderSetup();

		await fireEvent.change(screen.getByRole('combobox', { name: 'Turn initiative' }), {
			target: { value: 'fixed-top' }
		});
		await fireEvent.input(screen.getByRole('spinbutton', { name: 'Position' }), {
			target: { value: '0.5' }
		});

		await waitFor(async () => {
			const turn = (await loadChallengeLibrary()).challenges[0]?.creatures[0]?.turns[0];
			expect(turn?.initiative).toEqual({ kind: 'fixed-position', from: 'top', position: 0.5 });
		});
		expect(
			(screen.getByRole('button', { name: 'Roll Initiatives' }) as HTMLButtonElement).disabled
		).toBe(true);
	});

	it('hides the character initiative stat unless a turn is app-rolled, keeping the value', async () => {
		const challenge = createSetupChallenge();
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				initiativeStat: 4,
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [
					{
						id: '00000000-0000-4000-8000-000000000006' as StableId,
						initiative: { kind: 'roll', mode: 'manual' }
					}
				]
			}
		];
		await saveChallengeToLibrary(challenge);

		const view = render(setupChallengePage);
		await screen.findByRole('heading', { level: 1, name: 'Challenge setup' });
		const statName = 'Initiative stat (d6) for Aria';
		expect(screen.queryByRole('spinbutton', { name: statName })).toBeNull();

		await fireEvent.change(screen.getByRole('combobox', { name: /Turn initiative/ }), {
			target: { value: 'roll-app' }
		});
		const input = await screen.findByRole('spinbutton', { name: statName });
		expect((input as HTMLInputElement).value).toBe('4');

		await fireEvent.change(screen.getByRole('combobox', { name: /Turn initiative/ }), {
			target: { value: 'roll-manual' }
		});
		await waitFor(() => expect(screen.queryByRole('spinbutton', { name: statName })).toBeNull());
		await waitFor(async () => {
			expect((await loadChallengeLibrary()).challenges[0]?.creatures[0]).toHaveProperty(
				'initiativeStat',
				4
			);
		});
		view.unmount();
	});

	it('autosaves, restores, and clears a character initiative stat', async () => {
		const challenge = createSetupChallenge();
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [
					{
						id: '00000000-0000-4000-8000-000000000006' as StableId,
						initiative: { kind: 'roll', mode: 'app' }
					}
				]
			}
		];
		await saveChallengeToLibrary(challenge);

		const firstView = render(setupChallengePage);
		await screen.findByRole('heading', { level: 1, name: 'Challenge setup' });
		const input = screen.getByRole('spinbutton', { name: 'Initiative stat (d6) for Aria' });
		expect((input as HTMLInputElement).value).toBe('');
		await fireEvent.input(input, { target: { value: '3' } });

		await waitFor(async () => {
			expect((await loadChallengeLibrary()).challenges[0]?.creatures[0]).toHaveProperty(
				'initiativeStat',
				3
			);
		});

		firstView.unmount();
		const secondView = render(setupChallengePage);
		await screen.findByRole('heading', { level: 1, name: 'Challenge setup' });
		const restoredInput = screen.getByRole('spinbutton', {
			name: 'Initiative stat (d6) for Aria'
		});
		expect((restoredInput as HTMLInputElement).value).toBe('3');
		await fireEvent.input(restoredInput, { target: { value: '' } });

		await waitFor(async () => {
			const savedCharacter = (await loadChallengeLibrary()).challenges[0]?.creatures[0];
			expect(savedCharacter).not.toHaveProperty('initiativeStat');
		});
		secondView.unmount();
	});

	it('shows all initiative-stat issues and blocks starting until they are fixed', async () => {
		const challenge = createSetupChallenge();
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [
					{
						id: '00000000-0000-4000-8000-000000000006' as StableId,
						initiative: { kind: 'roll', mode: 'app' }
					}
				]
			}
		];
		await saveChallengeToLibrary(challenge);

		render(setupChallengePage);
		const disabledStartButton = await screen.findByRole('button', { name: 'Roll Initiatives' });
		expect((disabledStartButton as HTMLButtonElement).disabled).toBe(true);
		expect(disabledStartButton.classList.contains('ui-button')).toBe(true);
		expect(
			await screen.findAllByText(
				'An initiative stat is required for characters with app-rolled turns.'
			)
		).toHaveLength(1);
		await fireEvent.click(disabledStartButton);
		expect(mockedGoto).not.toHaveBeenCalled();

		await fireEvent.input(
			screen.getByRole('spinbutton', { name: 'Initiative stat (d6) for Aria' }),
			{
				target: { value: '2' }
			}
		);
		const startButton = await screen.findByRole('button', { name: 'Roll Initiatives' });
		expect(startButton.classList.contains('ui-button')).toBe(true);
		await fireEvent.click(startButton);
		expect(mockedGoto).not.toHaveBeenCalled();
	});

	it('saves the latest edits before starting the challenge', async () => {
		await renderSetup();

		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'Ready to roll' }
		});
		const startButton = screen.getByRole('button', { name: 'Roll Initiatives' });
		expect(document.querySelector('.challenge-setup')?.nextElementSibling).toBe(startButton);
		await fireEvent.click(startButton);

		expect(mockedGoto).not.toHaveBeenCalled();
		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.name).toBe('Ready to roll');
		});
	});

	it('stays in setup and shows an error when starting cannot save', async () => {
		await renderSetup();
		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'Unsaved change' }
		});
		vi.stubGlobal('indexedDB', undefined);

		await fireEvent.click(screen.getByRole('button', { name: 'Roll Initiatives' }));

		await screen.findByRole('alert');
		expectPageError('Changes could not be saved.');
		expect(mockedGoto).not.toHaveBeenCalled();
	});

	it.each(['unknown', 'unreadable'] as const)(
		'shows a recovery link when the stored challenge is %s',
		async (kind) => {
			if (kind === 'unknown') {
				mockedPage.params = { challengeId: '00000000-0000-4000-8000-000000000099' };
			} else {
				vi.stubGlobal('indexedDB', undefined);
			}

			render(setupChallengePage);

			expect(
				await screen.findByRole('heading', { name: 'Challenge setup unavailable' })
			).toBeTruthy();
			expectPageError(
				kind === 'unknown'
					? 'No saved challenge matches this setup URL.'
					: 'The saved challenges could not be loaded.'
			);
			expect(screen.getByRole('link', { name: 'Return to challenges' }).getAttribute('href')).toBe(
				'/challenges'
			);
		}
	);
});

describe('new challenge setup', () => {
	it('clears the generated order when fairness weight changes', async () => {
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
		challenge.runState = {
			initiativeResults: { [turnId]: 12 },
			generatedTurnOrder: [{ kind: 'turn', turnId: turnId }, { kind: 'spawn' }]
		};
		await saveChallengeToLibrary(challenge);

		await renderSetup();
		await fireEvent.input(screen.getByRole('slider', { name: 'Fairness weight slider' }), {
			target: { value: '4.25' }
		});

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.generatedTurnOrder).toBeUndefined();
		});
	});

	it('clears the generated order when turn placement changes', async () => {
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
		challenge.runState = {
			initiativeResults: { [turnId]: 12 },
			generatedTurnOrder: [{ kind: 'turn', turnId: turnId }, { kind: 'spawn' }]
		};
		await saveChallengeToLibrary(challenge);

		await renderSetup();
		const turn = within(screen.getByRole('group', { name: 'Aria' })).getByRole('group', {
			name: 'Turn 1'
		});
		await fireEvent.change(within(turn).getByRole('combobox', { name: 'Turn initiative' }), {
			target: { value: 'static' }
		});

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.initiativeResults[turnId]).toBeUndefined();
			expect(saved?.runState?.generatedTurnOrder).toBeUndefined();
		});
	});

	it('preserves the generated order when only the challenge name changes', async () => {
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
		challenge.runState = {
			initiativeResults: { [turnId]: 12 },
			generatedTurnOrder: [{ kind: 'turn', turnId: turnId }, { kind: 'spawn' }]
		};
		await saveChallengeToLibrary(challenge);

		await renderSetup();
		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'Ashen Company' }
		});

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.name).toBe('Ashen Company');
			expect(saved?.runState?.generatedTurnOrder).toEqual([
				{ kind: 'turn', turnId: turnId },
				{ kind: 'spawn' }
			]);
		});
	});

	it('wraps named form groups in cards', async () => {
		await renderSetup();

		const expectCard = (hasCard: boolean) => expect(hasCard).toBe(true);

		const settings = screen.getByRole('group', { name: 'Challenge settings' });
		expectCard(settings.parentElement?.classList.contains('card') ?? false);
		expect(screen.getByRole('heading', { name: 'Challenge settings', level: 2 })).toBeTruthy();

		const npcTypes = screen.getByRole('group', { name: 'NPC types' });
		expectCard(npcTypes.parentElement?.classList.contains('card') ?? false);
		expect(screen.getByRole('heading', { name: 'NPC types', level: 2 })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		const npcType = screen.getByRole('group', { name: 'NPC Type 1' });
		expectCard(npcType.parentElement?.classList.contains('card') ?? false);
		expect(screen.getByRole('heading', { name: 'NPC Type 1', level: 3 })).toBeTruthy();

		const factions = screen.getByRole('group', { name: 'Factions' });
		expectCard(factions.parentElement?.classList.contains('card') ?? false);
		expect(screen.getByRole('heading', { name: 'Factions', level: 2 })).toBeTruthy();
		const players = within(factions).getByRole('group', { name: 'Players' });
		expectCard(players.parentElement?.classList.contains('card') ?? false);
		expect(screen.getByRole('heading', { name: 'Players', level: 3 })).toBeTruthy();
		await fireEvent.click(within(players).getByRole('button', { name: 'Add Player' }));
		const player = within(players).getByRole('group', { name: 'Player 1' });
		expectCard(player.parentElement?.classList.contains('card') ?? false);
		expect(screen.getByRole('heading', { name: 'Player 1', level: 4 })).toBeTruthy();
		const turn = within(player).getByRole('group', { name: 'Turn 1' });
		expectCard(turn.parentElement?.classList.contains('card') ?? false);
		expect(screen.getByRole('heading', { name: 'Turn 1', level: 5 })).toBeTruthy();
	});

	it('shows challenge settings, the NPC type strip, and faction board', async () => {
		await renderSetup();

		expect(screen.getByRole('textbox', { name: 'Challenge name' })).toBeTruthy();
		const fairnessWeight = screen.getByRole('slider', { name: 'Fairness weight slider' });
		expect(fairnessWeight.getAttribute('min')).toBe('0');
		expect(fairnessWeight.getAttribute('max')).toBe('10');
		expect(fairnessWeight.getAttribute('step')).toBe('0.01');
		expect(
			(screen.getByRole('spinbutton', { name: 'Fairness weight value' }) as HTMLInputElement).value
		).toBe('3');
		expect(screen.getByText('Initiative and faction balance have similar influence.')).toBeTruthy();
		expect(screen.queryByRole('combobox', { name: 'Character initiative default' })).toBeNull();
		expect(screen.queryByRole('combobox', { name: 'NPC initiative default' })).toBeNull();
		expect(screen.getByRole('group', { name: 'Challenge settings' })).toBeTruthy();
		expect(screen.getByRole('group', { name: 'NPC types' })).toBeTruthy();
		expect(screen.getByRole('group', { name: 'Factions' })).toBeTruthy();
		expect(screen.getByRole('group', { name: 'Players' })).toBeTruthy();
		expect(screen.getByRole('group', { name: 'Enemies' })).toBeTruthy();
		expect(screen.queryByRole('combobox', { name: 'Faction' })).toBeNull();
	});
});

describe('challenge setup persistence', () => {
	it('loads the challenge from IndexedDB', async () => {
		await saveChallengeToLibrary({ ...createSetupChallenge(), name: 'Stored name' });

		await renderSetup();

		expect(
			(screen.getByRole('textbox', { name: 'Challenge name' }) as HTMLInputElement).value
		).toBe('Stored name');
	});

	it('saves edits to IndexedDB', async () => {
		await renderSetup();

		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'Edited' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.name).toBe('Edited');
			expect(saved?.npcTypes).toHaveLength(1);
		});
	});

	it('hides the character initiative stat unless a turn is app-rolled, keeping the value', async () => {
		const challenge = createSetupChallenge();
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				initiativeStat: 4,
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [
					{
						id: '00000000-0000-4000-8000-000000000006' as StableId,
						initiative: { kind: 'roll', mode: 'manual' }
					}
				]
			}
		];
		await saveChallengeToLibrary(challenge);

		const view = render(setupChallengePage);
		await screen.findByRole('heading', { level: 1, name: 'Challenge setup' });
		const statName = 'Initiative stat (d6) for Aria';
		expect(screen.queryByRole('spinbutton', { name: statName })).toBeNull();

		await fireEvent.change(screen.getByRole('combobox', { name: /Turn initiative/ }), {
			target: { value: 'roll-app' }
		});
		const input = await screen.findByRole('spinbutton', { name: statName });
		expect((input as HTMLInputElement).value).toBe('4');

		await fireEvent.change(screen.getByRole('combobox', { name: /Turn initiative/ }), {
			target: { value: 'roll-manual' }
		});
		await waitFor(() => expect(screen.queryByRole('spinbutton', { name: statName })).toBeNull());
		await waitFor(async () => {
			expect((await loadChallengeLibrary()).challenges[0]?.creatures[0]).toHaveProperty(
				'initiativeStat',
				4
			);
		});
		view.unmount();
	});

	it('autosaves, restores, and clears a character initiative stat', async () => {
		const challenge = createSetupChallenge();
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [
					{
						id: '00000000-0000-4000-8000-000000000006' as StableId,
						initiative: { kind: 'roll', mode: 'app' }
					}
				]
			}
		];
		await saveChallengeToLibrary(challenge);

		const firstView = render(setupChallengePage);
		await screen.findByRole('heading', { level: 1, name: 'Challenge setup' });
		const input = screen.getByRole('spinbutton', { name: 'Initiative stat (d6) for Aria' });
		expect((input as HTMLInputElement).value).toBe('');
		await fireEvent.input(input, { target: { value: '3' } });

		await waitFor(async () => {
			expect((await loadChallengeLibrary()).challenges[0]?.creatures[0]).toHaveProperty(
				'initiativeStat',
				3
			);
		});

		firstView.unmount();
		const secondView = render(setupChallengePage);
		await screen.findByRole('heading', { level: 1, name: 'Challenge setup' });
		const restoredInput = screen.getByRole('spinbutton', {
			name: 'Initiative stat (d6) for Aria'
		});
		expect((restoredInput as HTMLInputElement).value).toBe('3');
		await fireEvent.input(restoredInput, { target: { value: '' } });

		await waitFor(async () => {
			const savedCharacter = (await loadChallengeLibrary()).challenges[0]?.creatures[0];
			expect(savedCharacter).not.toHaveProperty('initiativeStat');
		});
		secondView.unmount();
	});

	it('shows all initiative-stat issues and blocks starting until they are fixed', async () => {
		const challenge = createSetupChallenge();
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [
					{
						id: '00000000-0000-4000-8000-000000000006' as StableId,
						initiative: { kind: 'roll', mode: 'app' }
					}
				]
			}
		];
		await saveChallengeToLibrary(challenge);

		render(setupChallengePage);
		const disabledStartButton = await screen.findByRole('button', { name: 'Roll Initiatives' });
		expect((disabledStartButton as HTMLButtonElement).disabled).toBe(true);
		expect(disabledStartButton.classList.contains('ui-button')).toBe(true);
		expect(
			await screen.findAllByText(
				'An initiative stat is required for characters with app-rolled turns.'
			)
		).toHaveLength(1);
		await fireEvent.click(disabledStartButton);
		expect(mockedGoto).not.toHaveBeenCalled();

		await fireEvent.input(
			screen.getByRole('spinbutton', { name: 'Initiative stat (d6) for Aria' }),
			{
				target: { value: '2' }
			}
		);
		const startButton = await screen.findByRole('button', { name: 'Roll Initiatives' });
		expect(startButton.classList.contains('ui-button')).toBe(true);
		await fireEvent.click(startButton);
		expect(mockedGoto).not.toHaveBeenCalled();
	});

	it('saves the latest edits before starting the challenge', async () => {
		await renderSetup();

		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'Ready to roll' }
		});
		const startButton = screen.getByRole('button', { name: 'Roll Initiatives' });
		expect(document.querySelector('.challenge-setup')?.nextElementSibling).toBe(startButton);
		await fireEvent.click(startButton);

		expect(mockedGoto).not.toHaveBeenCalled();
		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.name).toBe('Ready to roll');
		});
	});

	it('stays in setup and shows an error when starting cannot save', async () => {
		await renderSetup();
		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'Unsaved change' }
		});
		vi.stubGlobal('indexedDB', undefined);

		await fireEvent.click(screen.getByRole('button', { name: 'Roll Initiatives' }));

		await screen.findByRole('alert');
		expectPageError('Changes could not be saved.');
		expect(mockedGoto).not.toHaveBeenCalled();
	});

	it.each(['unknown', 'unreadable'] as const)(
		'shows a recovery link when the stored challenge is %s',
		async (kind) => {
			if (kind === 'unknown') {
				mockedPage.params = { challengeId: '00000000-0000-4000-8000-000000000099' };
			} else {
				vi.stubGlobal('indexedDB', undefined);
			}

			render(setupChallengePage);

			expect(
				await screen.findByRole('heading', { name: 'Challenge setup unavailable' })
			).toBeTruthy();
			expectPageError(
				kind === 'unknown'
					? 'No saved challenge matches this setup URL.'
					: 'The saved challenges could not be loaded.'
			);
			expect(screen.getByRole('link', { name: 'Return to challenges' }).getAttribute('href')).toBe(
				'/challenges'
			);
		}
	);
});

describe('new challenge setup', () => {
	it('clears the generated order when fairness weight changes', async () => {
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
		challenge.runState = {
			initiativeResults: { [turnId]: 12 },
			generatedTurnOrder: [{ kind: 'turn', turnId: turnId }, { kind: 'spawn' }]
		};
		await saveChallengeToLibrary(challenge);

		await renderSetup();
		await fireEvent.input(screen.getByRole('slider', { name: 'Fairness weight slider' }), {
			target: { value: '4.25' }
		});

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.generatedTurnOrder).toBeUndefined();
		});
	});

	it('clears the generated order when turn placement changes', async () => {
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
		challenge.runState = {
			initiativeResults: { [turnId]: 12 },
			generatedTurnOrder: [{ kind: 'turn', turnId: turnId }, { kind: 'spawn' }]
		};
		await saveChallengeToLibrary(challenge);

		await renderSetup();
		const turn = within(screen.getByRole('group', { name: 'Aria' })).getByRole('group', {
			name: 'Turn 1'
		});
		await fireEvent.change(within(turn).getByRole('combobox', { name: 'Turn initiative' }), {
			target: { value: 'static' }
		});

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.initiativeResults[turnId]).toBeUndefined();
			expect(saved?.runState?.generatedTurnOrder).toBeUndefined();
		});
	});

	it('preserves the generated order when only the challenge name changes', async () => {
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
		challenge.runState = {
			initiativeResults: { [turnId]: 12 },
			generatedTurnOrder: [{ kind: 'turn', turnId: turnId }, { kind: 'spawn' }]
		};
		await saveChallengeToLibrary(challenge);

		await renderSetup();
		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'Ashen Company' }
		});

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.name).toBe('Ashen Company');
			expect(saved?.runState?.generatedTurnOrder).toEqual([
				{ kind: 'turn', turnId: turnId },
				{ kind: 'spawn' }
			]);
		});
	});

	it('uses shared card surfaces while preserving named form groups', async () => {
		await renderSetup();

		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- DOM elements are not readonly
		const expectCard = (group: HTMLElement, variant: string, spacing: string) => {
			const card = group.parentElement;
			expect(card?.classList.contains('card')).toBe(true);
			expect(card?.classList.contains(`card--${variant}`)).toBe(true);
			expect(card?.classList.contains(`card--${spacing}`)).toBe(true);
		};

		const settings = screen.getByRole('group', { name: 'Challenge settings' });
		expectCard(settings, 'surface', 'standard');
		expect(screen.getByRole('heading', { name: 'Challenge settings', level: 2 })).toBeTruthy();

		const npcTypes = screen.getByRole('group', { name: 'NPC types' });
		expectCard(npcTypes, 'surface', 'standard');
		expect(screen.getByRole('heading', { name: 'NPC types', level: 2 })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		const npcType = screen.getByRole('group', { name: 'NPC Type 1' });
		expectCard(npcType, 'subtle', 'compact');
		expect(screen.getByRole('heading', { name: 'NPC Type 1', level: 3 })).toBeTruthy();

		const factions = screen.getByRole('group', { name: 'Factions' });
		expectCard(factions, 'surface', 'standard');
		expect(screen.getByRole('heading', { name: 'Factions', level: 2 })).toBeTruthy();
		const players = within(factions).getByRole('group', { name: 'Players' });
		expectCard(players, 'inset', 'compact');
		expect(screen.getByRole('heading', { name: 'Players', level: 3 })).toBeTruthy();
		await fireEvent.click(within(players).getByRole('button', { name: 'Add Player' }));
		const player = within(players).getByRole('group', { name: 'Player 1' });
		expectCard(player, 'surface', 'compact');
		expect(screen.getByRole('heading', { name: 'Player 1', level: 4 })).toBeTruthy();
		const turn = within(player).getByRole('group', { name: 'Turn 1' });
		expectCard(turn, 'inset', 'compact');
		expect(screen.getByRole('heading', { name: 'Turn 1', level: 5 })).toBeTruthy();
	});

	it('shows challenge settings, the NPC type strip, and faction board', async () => {
		await renderSetup();

		expect(screen.getByRole('textbox', { name: 'Challenge name' })).toBeTruthy();
		const fairnessWeight = screen.getByRole('slider', { name: 'Fairness weight slider' });
		expect(fairnessWeight.getAttribute('min')).toBe('0');
		expect(fairnessWeight.getAttribute('max')).toBe('10');
		expect(fairnessWeight.getAttribute('step')).toBe('0.01');
		expect(
			(screen.getByRole('spinbutton', { name: 'Fairness weight value' }) as HTMLInputElement).value
		).toBe('3');
		expect(screen.getByText('Initiative and faction balance have similar influence.')).toBeTruthy();
		expect(screen.queryByRole('combobox', { name: 'Character initiative default' })).toBeNull();
		expect(screen.queryByRole('combobox', { name: 'NPC initiative default' })).toBeNull();
		expect(screen.getByRole('group', { name: 'Challenge settings' })).toBeTruthy();
		expect(screen.getByRole('group', { name: 'NPC types' })).toBeTruthy();
		expect(screen.getByRole('group', { name: 'Factions' })).toBeTruthy();
		expect(screen.getByRole('group', { name: 'Players' })).toBeTruthy();
		expect(screen.getByRole('group', { name: 'Enemies' })).toBeTruthy();
		expect(screen.queryByRole('combobox', { name: 'Faction' })).toBeNull();
	});

	it('updates the visible fairness value as the slider moves', async () => {
		await renderSetup();

		await fireEvent.input(screen.getByRole('slider', { name: 'Fairness weight slider' }), {
			target: { value: '4.25' }
		});
		expect(
			(screen.getByRole('spinbutton', { name: 'Fairness weight value' }) as HTMLInputElement).value
		).toBe('4.25');
	});

	it('accepts a fairness weight above the slider range and keeps the slider at its maximum', async () => {
		await renderSetup();

		const numericInput = screen.getByRole('spinbutton', {
			name: 'Fairness weight value'
		}) as HTMLInputElement;
		const slider = screen.getByRole('slider', {
			name: 'Fairness weight slider'
		}) as HTMLInputElement;
		expect(numericInput.getAttribute('min')).toBe('0');
		expect(numericInput.getAttribute('max')).toBeNull();

		await fireEvent.input(numericInput, { target: { value: '12.75' } });
		expect(numericInput.value).toBe('12.75');
		expect(slider.value).toBe('10');

		await fireEvent.input(slider, { target: { value: '8.5' } });
		expect(numericInput.value).toBe('8.5');
	});

	it.each([
		['0', 'Pure initiative ordering.'],
		['3', 'Initiative and faction balance have similar influence.'],
		['5', 'Faction balance has a stronger influence than initiative.'],
		['10', 'Turn order approaches a proportional round-robin across factions.']
	])('describes fairness weight %s', async (value, description) => {
		await renderSetup();

		await fireEvent.input(screen.getByRole('slider', { name: 'Fairness weight slider' }), {
			target: { value }
		});
		expect(screen.getByText(description)).toBeTruthy();
	});

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

	it('uses hard-coded initiative modes for new creatures and allows independent turn overrides', async () => {
		await renderSetup();

		const playersPanel = screen.getByRole('group', { name: 'Players' });
		const enemiesPanel = screen.getByRole('group', { name: 'Enemies' });
		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		const firstPlayer = within(playersPanel).getByRole('group', { name: 'Player 1' });
		const secondPlayer = within(playersPanel).getByRole('group', { name: 'Player 2' });
		expect(
			(within(firstPlayer).getByRole('combobox', { name: 'Turn initiative' }) as HTMLSelectElement)
				.value
		).toBe('roll-manual');
		expect(
			(within(secondPlayer).getByRole('combobox', { name: 'Turn initiative' }) as HTMLSelectElement)
				.value
		).toBe('roll-manual');

		await fireEvent.change(within(firstPlayer).getByRole('combobox', { name: 'Turn initiative' }), {
			target: { value: 'roll-app' }
		});
		await fireEvent.change(
			within(secondPlayer).getByRole('combobox', { name: 'Turn initiative' }),
			{
				target: { value: 'roll-manual' }
			}
		);
		expect(
			(within(firstPlayer).getByRole('combobox', { name: 'Turn initiative' }) as HTMLSelectElement)
				.value
		).toBe('roll-app');
		expect(
			(within(secondPlayer).getByRole('combobox', { name: 'Turn initiative' }) as HTMLSelectElement)
				.value
		).toBe('roll-manual');
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		await fireEvent.click(within(enemiesPanel).getByRole('button', { name: 'Add NPC' }));
		const npc = within(enemiesPanel).getByRole('group', { name: 'NPC Type 1 1' });
		expect(
			(within(npc).getByRole('combobox', { name: 'Turn initiative' }) as HTMLSelectElement).value
		).toBe('roll-app');
	});

	it('hides a creature with zero turns and keeps its visibility when turns are added', async () => {
		await renderSetup();

		const playersPanel = screen.getByRole('group', { name: 'Players' });
		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		const player = within(playersPanel).getByRole('group', { name: 'Player 1' });
		const visibility = within(player).getByRole('checkbox', {
			name: 'Hidden from viewers: Player 1'
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

	it('adds and removes turn cards, renumbers them, and represents no initiative with zero turns', async () => {
		await renderSetup();

		const playersPanel = screen.getByRole('group', { name: 'Players' });
		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		const player = within(playersPanel).getByRole('group', { name: 'Player 1' });
		expect(within(player).getByRole('group', { name: 'Turn 1' })).toBeTruthy();
		expect(screen.queryByRole('option', { name: 'No initiative' })).toBeNull();
		expect(within(player).getByRole('button', { name: 'Add turn for Player 1' }).className).toBe(
			within(playersPanel).getByRole('button', { name: 'Add Player' }).className
		);

		await fireEvent.click(within(player).getByRole('button', { name: 'Add turn for Player 1' }));
		const secondTurn = within(player).getByRole('group', { name: 'Turn 2' });
		expect(secondTurn).toBeTruthy();
		expect(
			(within(secondTurn).getByRole('combobox', { name: 'Turn initiative' }) as HTMLSelectElement)
				.value
		).toBe('roll-manual');

		await fireEvent.click(
			within(player).getByRole('button', { name: 'Remove Turn 1 for Player 1' })
		);
		expect(within(player).getByRole('group', { name: 'Turn 1' })).toBeTruthy();
		expect(within(player).queryByRole('group', { name: 'Turn 2' })).toBeNull();

		await fireEvent.click(
			within(player).getByRole('button', { name: 'Remove Turn 1 for Player 1' })
		);
		expect(within(player).queryByRole('group', { name: 'Turn 1' })).toBeNull();
		expect(screen.queryByRole('option', { name: 'No initiative' })).toBeNull();

		await fireEvent.click(within(player).getByRole('button', { name: 'Add turn for Player 1' }));
		expect(within(player).getByRole('group', { name: 'Turn 1' })).toBeTruthy();
	});

	it('labels target turns and confirms transitive removal when deleting a referenced turn', async () => {
		await renderSetup();

		const playersPanel = screen.getByRole('group', { name: 'Players' });
		for (let index = 0; index < 3; index += 1) {
			await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		}
		const firstPlayer = within(playersPanel).getByRole('group', { name: 'Player 1' });
		const secondPlayer = within(playersPanel).getByRole('group', { name: 'Player 2' });
		const thirdPlayer = within(playersPanel).getByRole('group', { name: 'Player 3' });
		await fireEvent.click(
			within(firstPlayer).getByRole('button', { name: 'Add turn for Player 1' })
		);
		const secondTurn = within(firstPlayer).getByRole('group', { name: 'Turn 2' });
		await fireEvent.change(within(secondTurn).getByRole('combobox', { name: 'Turn initiative' }), {
			target: { value: 'relative-before' }
		});
		expect(within(secondTurn).getByRole('option', { name: 'Player 1 - Turn 1' })).toBeTruthy();
		expect(within(secondTurn).getByRole('option', { name: 'Player 2 - Turn 1' })).toBeTruthy();

		await setRelativeTarget('Player 2', 'Turn 1', 'before', 'Player 1 - Turn 1');
		await setRelativeTarget('Player 3', 'Turn 1', 'after', 'Player 2 - Turn 1');

		const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
		await fireEvent.click(
			within(firstPlayer).getByRole('button', { name: 'Remove Turn 1 for Player 1' })
		);
		expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('3 dependent turns'));
		expect(within(secondPlayer).getByRole('group', { name: 'Turn 1' })).toBeTruthy();
		expect(within(thirdPlayer).getByRole('group', { name: 'Turn 1' })).toBeTruthy();

		confirmation.mockReturnValue(true);
		await fireEvent.click(
			within(firstPlayer).getByRole('button', { name: 'Remove Turn 1 for Player 1' })
		);
		expect(within(firstPlayer).queryByRole('group', { name: 'Turn 1' })).toBeNull();
		expect(within(firstPlayer).queryByRole('group', { name: 'Turn 2' })).toBeNull();
		expect(within(firstPlayer).getByRole('button', { name: 'Add turn for Player 1' })).toBeTruthy();
		expect(within(secondPlayer).queryByRole('group', { name: 'Turn 1' })).toBeNull();
		expect(within(thirdPlayer).queryByRole('group', { name: 'Turn 1' })).toBeNull();
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
