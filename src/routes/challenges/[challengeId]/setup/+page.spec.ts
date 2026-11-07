import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import setupChallengePage from './+page.svelte';
import { saveChallengeToLibrary, loadChallengeLibrary, type StableId } from '#lib/challenge';
import {
	createSetupChallenge,
	setupChallengeId,
	renderSetup,
	expectPageError
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
		).toHaveLength(2);
		await fireEvent.click(disabledStartButton);
		expect(mockedGoto).not.toHaveBeenCalled();

		await fireEvent.input(
			screen.getByRole('spinbutton', { name: 'Initiative stat (d6) for Aria' }),
			{
				target: { value: '2' }
			}
		);
		const startLink = await screen.findByRole('link', { name: 'Roll Initiatives' });
		expect(startLink.getAttribute('href')).toBe(`/challenges/${setupChallengeId}/roll`);
		expect(startLink.classList.contains('ui-button')).toBe(true);
		await fireEvent.click(startLink);
		await waitFor(() =>
			expect(mockedGoto).toHaveBeenCalledWith(`/challenges/${setupChallengeId}/roll`)
		);
	});

	it('saves the latest edits before starting the challenge', async () => {
		await renderSetup();

		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'Ready to roll' }
		});
		const startLink = screen.getByRole('link', { name: 'Roll Initiatives' });
		expect(startLink.getAttribute('href')).toBe(`/challenges/${setupChallengeId}/roll`);
		expect(document.querySelector('.challenge-setup')?.nextElementSibling).toBe(startLink);
		await fireEvent.click(startLink);

		await waitFor(() => expect(mockedGoto).toHaveBeenCalledOnce());
		expect(mockedGoto).toHaveBeenCalledWith(`/challenges/${setupChallengeId}/roll`);
		const saved = (await loadChallengeLibrary()).challenges[0];
		expect(saved?.name).toBe('Ready to roll');
	});

	it('stays in setup and shows an error when starting cannot save', async () => {
		await renderSetup();
		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'Unsaved change' }
		});
		vi.stubGlobal('indexedDB', undefined);

		await fireEvent.click(screen.getByRole('link', { name: 'Roll Initiatives' }));

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
			expect(screen.getByRole('link', { name: 'Start a new challenge' }).getAttribute('href')).toBe(
				'/challenges/new'
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

		const expectCard = (group: Readonly<HTMLElement>) =>
			expect(group.parentElement?.classList.contains('card')).toBe(true);

		const settings = screen.getByRole('group', { name: 'Challenge settings' });
		expectCard(settings);
		expect(screen.getByRole('heading', { name: 'Challenge settings', level: 2 })).toBeTruthy();

		const npcTypes = screen.getByRole('group', { name: 'NPC types' });
		expectCard(npcTypes);
		expect(screen.getByRole('heading', { name: 'NPC types', level: 2 })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		const npcType = screen.getByRole('group', { name: 'NPC Type 1' });
		expectCard(npcType);
		expect(screen.getByRole('heading', { name: 'NPC Type 1', level: 3 })).toBeTruthy();

		const factions = screen.getByRole('group', { name: 'Factions' });
		expectCard(factions);
		expect(screen.getByRole('heading', { name: 'Factions', level: 2 })).toBeTruthy();
		const players = within(factions).getByRole('group', { name: 'Players' });
		expectCard(players);
		expect(screen.getByRole('heading', { name: 'Players', level: 3 })).toBeTruthy();
		await fireEvent.click(within(players).getByRole('button', { name: 'Add Player' }));
		const player = within(players).getByRole('group', { name: 'Player 1' });
		expectCard(player);
		expect(screen.getByRole('heading', { name: 'Player 1', level: 4 })).toBeTruthy();
		const turn = within(player).getByRole('group', { name: 'Turn 1' });
		expectCard(turn);
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
