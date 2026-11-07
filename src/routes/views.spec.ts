import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import type { Component } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import savedChallengesPage from './challenges/+page.svelte';
import rollChallengePage from './challenges/[challengeId]/roll/+page.svelte';
import turnOrderPage from './challenges/[challengeId]/run/+page.svelte';
import setupChallengePage from './challenges/[challengeId]/setup/+page.svelte';
import newChallengeEntryPage from './challenges/new/+page.svelte';
import joinSessionPage from './join/+page.svelte';
import {
	loadChallengeLibrary,
	saveChallengeToLibrary,
	type Challenge,
	type GeneratedTurnOrder,
	type StableId
} from '#lib';

async function renderSetup() {
	render(setupChallengePage);
	await screen.findByRole('heading', { level: 1, name: 'Challenge setup' });
}

const { mockedPage, mockedGoto } = vi.hoisted(() => ({
	mockedPage: {
		params: {} as Record<string, string>
	},
	mockedGoto: vi.fn()
}));

vi.mock('$app/state', () => ({ page: mockedPage }));
vi.mock('$app/navigation', () => ({ goto: mockedGoto }));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.clearAllMocks();
});

const setupChallengeId = '00000000-0000-4000-8000-000000000001' as StableId;

function createSetupChallenge(): Challenge {
	const createdAt = new Date('2026-01-01T00:00:00.000Z');
	return {
		id: setupChallengeId,
		name: '',
		createdAt,
		updatedAt: createdAt,
		factions: [
			{ id: '00000000-0000-4000-8000-000000000002' as StableId, name: 'Players', color: 'blue' },
			{ id: '00000000-0000-4000-8000-000000000003' as StableId, name: 'Enemies', color: 'red' }
		],
		npcTypes: [],
		fairnessWeight: 3,
		creatures: []
	};
}

beforeEach(async () => {
	vi.stubGlobal('indexedDB', new IDBFactory());
	const challenge = createSetupChallenge();
	await saveChallengeToLibrary(challenge);
	mockedPage.params = { challengeId: challenge.id };
});

const views: { name: string; page: Component; heading: string }[] = [
	{ name: 'challenge setup', page: setupChallengePage, heading: 'Challenge setup' },
	{ name: 'running challenge', page: rollChallengePage, heading: 'Initiative rolling' },
	{ name: 'saved challenges', page: savedChallengesPage, heading: 'Saved challenges' },
	{ name: 'join session', page: joinSessionPage, heading: 'Join a live session' }
];

async function setRelativeTarget(
	creatureName: string,
	turnName: string,
	relation: 'before' | 'after',
	targetName: string
) {
	const turn = within(screen.getByRole('group', { name: creatureName })).getByRole('group', {
		name: turnName
	});
	await fireEvent.change(within(turn).getByRole('combobox', { name: 'Turn initiative' }), {
		target: { value: `relative-${relation}` }
	});
	const targetSelector = within(turn).getByRole('combobox', { name: 'Target turn' });
	const targetOption = within(targetSelector).getByRole('option', { name: targetName });
	await fireEvent.change(targetSelector, { target: { value: targetOption.getAttribute('value') } });
}

describe.each(views)('$name view', ({ page, heading }) => {
	it('has a heading and a link back to the landing page', async () => {
		render(page);

		expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeTruthy();
	});
});

describe('new challenge entry', () => {
	it('saves a draft and redirects to its setup route without page state', async () => {
		render(newChallengeEntryPage);

		await waitFor(() => expect(mockedGoto).toHaveBeenCalledOnce());

		const [href, options] = mockedGoto.mock.calls[0] as [string, Record<string, unknown>];
		expect(href).toMatch(/^\/challenges\/[0-9a-f-]+\/setup$/i);
		expect(options['replace']).toBe(true);
		expect(options['state']).toBeUndefined();
		const saved = (await loadChallengeLibrary()).challenges.find(
			(challenge) => challenge.id === href.split('/')[2]
		);
		expect(saved?.creatures).toEqual([]);
	});

	it('stays on the page with a retry when saving fails', async () => {
		vi.stubGlobal('indexedDB', undefined);

		render(newChallengeEntryPage);

		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toBe('The new challenge could not be saved.');
		expect(
			screen
				.getByText('ChallengeLibraryStorageError: IndexedDB is not available.')
				.hasAttribute('hidden')
		).toBe(true);
		await fireEvent.click(screen.getByRole('button', { name: 'Display error details' }));
		expect(
			screen
				.getByText('ChallengeLibraryStorageError: IndexedDB is not available.')
				.hasAttribute('hidden')
		).toBe(false);
		expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
		expect(mockedGoto).not.toHaveBeenCalled();
	});

	it('shows validation details when the stored library is invalid', async () => {
		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('soulstone-challenge-library', 1);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		await new Promise<void>((resolve, reject) => {
			const transaction = database.transaction('challengeLibrary', 'readwrite');
			transaction
				.objectStore('challengeLibrary')
				.put({ formatVersion: 2, challenges: [] }, 'current');
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
			transaction.onabort = () => reject(transaction.error);
		});
		database.close();

		render(newChallengeEntryPage);

		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toBe('The new challenge could not be saved.');
		expect(
			screen
				.getByText(/\$\.formatVersion: Unsupported challenge library version\./)
				.hasAttribute('hidden')
		).toBe(true);
		await fireEvent.click(screen.getByRole('button', { name: 'Display error details' }));
		expect(
			screen
				.getByText(/\$\.formatVersion: Unsupported challenge library version\./)
				.hasAttribute('hidden')
		).toBe(false);
		expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
		expect(mockedGoto).not.toHaveBeenCalled();
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

		expect(await screen.findByRole('alert')).toBeTruthy();
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
			expect(screen.getByRole('link', { name: 'Start a new challenge' }).getAttribute('href')).toBe(
				'/challenges/new'
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
			initiativeResults: { [secondTurnId]: 8 },
			generatedTurnOrder: [
				{ kind: 'turn', turnId: secondTurnId },
				{ kind: 'turn', turnId: firstTurnId },
				{ kind: 'spawn' }
			]
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
		await fireEvent.click(screen.getByRole('link', { name: 'Return to setup' }));

		await waitFor(() =>
			expect(mockedGoto).toHaveBeenCalledWith(`/challenges/${setupChallengeId}/setup`)
		);
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
		await fireEvent.click(screen.getByRole('link', { name: 'Continue to turn order' }));

		await waitFor(() =>
			expect(mockedGoto).toHaveBeenCalledWith(`/challenges/${setupChallengeId}/run`)
		);
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

		expect(await screen.findByRole('alert')).toBeTruthy();
		await fireEvent.click(screen.getByRole('link', { name: 'Return to setup' }));
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
		await fireEvent.click(screen.getByRole('link', { name: 'Continue to turn order' }));

		expect(await screen.findByRole('alert')).toBeTruthy();
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
					{ id: emptyCharacterTurnId, initiative: { kind: 'roll', mode: 'manual' } }
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
		expect(screen.getByText('Initiative for Aria - Turn 1 is above 18.')).toBeTruthy();
		expect(characterInput.classList.contains('form-control--warning')).toBe(true);
		await fireEvent.input(characterInput, { target: { value: '' } });
		expect(characterInput.value).toBe('');
		expect(characterInput.classList.contains('form-control--warning')).toBe(false);
		expect(screen.getByText('Initiative result: 12')).toBeTruthy();
		await fireEvent.input(emptyInput, { target: { value: '21' } });
		expect(emptyInput.value).toBe('21');
		expect(emptyInput.classList.contains('form-control--warning')).toBe(true);
		expect(screen.getByText('Initiative for Aria - Turn 3 is above 18.')).toBeTruthy();
		await fireEvent.input(npcInput, { target: { value: '20' } });
		expect(screen.getByText('Initiative for Sentinel B - Turn 1 is above 18.')).toBeTruthy();
		await fireEvent.input(emptyInput, { target: { value: 'not-a-number' } });
		expect(emptyInput.value).toBe('');
		expect(emptyInput.classList.contains('form-control--warning')).toBe(false);
		expect(screen.queryByText('Initiative for Aria - Turn 3 is above 18.')).toBeNull();
		expect(screen.getByText('Initiative for Sentinel B - Turn 1 is above 18.')).toBeTruthy();
		await fireEvent.input(emptyInput, { target: { value: '1.5' } });
		expect(emptyInput.value).toBe('1.5');
		expect(emptyInput.classList.contains('form-control--invalid')).toBe(true);
		expect(screen.queryByText('Initiative for Aria - Turn 3 is above 18.')).toBeNull();
		expect(screen.getByText('Initiative for Sentinel B - Turn 1 is above 18.')).toBeTruthy();
		await fireEvent.input(npcInput, { target: { value: '-1' } });
		expect(npcInput.classList.contains('form-control--invalid')).toBe(true);
		expect(screen.queryByText('Initiative for Sentinel B - Turn 1 is above 18.')).toBeNull();
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
			screen.getByText(
				'Aria - Turn 1 cannot be rolled because its initiative stat is missing or invalid.'
			)
		).toBeTruthy();
		expect(
			screen.getByText(
				'Aria - Turn 2 cannot be rolled because its initiative stat is missing or invalid.'
			)
		).toBeTruthy();
		expect(screen.getByText('Initiative result: 10')).toBeTruthy();
	});

	it('links back to setup for the loaded challenge', async () => {
		render(rollChallengePage);

		const setupLink = await screen.findByRole('link', { name: 'Return to setup' });
		expect(setupLink.getAttribute('href')).toBe(`/challenges/${setupChallengeId}/setup`);
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

			expect(await screen.findByText(message)).toBeTruthy();
			expect(await screen.findByRole('heading', { name: 'Initiative rolling' })).toBeTruthy();
			expect(document.title).toBe('Initiative rolling | Soulstone Initiative Tracker');
			expect(screen.getByText('Challenge unavailable')).toBeTruthy();
			expect(screen.getByRole('link', { name: 'Return to home' }).getAttribute('href')).toBe('/');
		}
	);
});

describe('turn-order run route', () => {
	const ariaTurnId = '00000000-0000-4000-8000-000000000023' as StableId;
	const rookTurnId = '00000000-0000-4000-8000-000000000024' as StableId;
	const ariaSecondTurnId = '00000000-0000-4000-8000-000000000027' as StableId;

	function createRunChallenge(): Challenge {
		const challenge = createSetupChallenge();
		challenge.name = 'Ashen Company';
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000025' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [{ id: ariaTurnId, initiative: { kind: 'roll', mode: 'manual' } }]
			},
			{
				id: '00000000-0000-4000-8000-000000000026' as StableId,
				kind: 'character',
				name: 'Rook',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [{ id: rookTurnId, initiative: { kind: 'roll', mode: 'manual' } }]
			}
		];
		challenge.runState = {
			initiativeResults: { [ariaTurnId]: 6, [rookTurnId]: 12 },
			generatedTurnOrder: [
				{ kind: 'turn', turnId: ariaTurnId },
				{ kind: 'turn', turnId: rookTurnId },
				{ kind: 'spawn' }
			]
		};
		return challenge;
	}

	it('renders the saved order as numbered faction-colored cards', async () => {
		const challenge = createRunChallenge();
		challenge.creatures[1]!.factionId = '00000000-0000-4000-8000-000000000003' as StableId;
		challenge.runState!.generatedTurnOrder = [
			{ kind: 'turn', turnId: rookTurnId },
			{ kind: 'turn', turnId: ariaTurnId },
			{ kind: 'spawn' }
		];
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);

		const savedOrder = await screen.findByRole('list', { name: 'Generated turn order' });
		const items = within(savedOrder).getAllByRole('listitem');
		expect(items.map((item) => item.querySelector('h2')?.textContent)).toEqual([
			'Rook',
			'Aria',
			'Spawn'
		]);
		expect(
			items.map((item) => item.querySelector('.turn-order-position')?.textContent?.trim())
		).toEqual(['1', '2', '3']);
		expect(items[0]?.textContent).toContain('Enemies');
		expect(items[1]?.textContent).toContain('Players');
		expect(
			items.map((item) =>
				item
					.querySelector<HTMLElement>('.turn-order-card-tone')
					?.style.getPropertyValue('--faction-color')
			)
		).toEqual(['#c76a6e', '#5687c8', undefined]);
	});

	it('hides and restores all turns for a creature without changing the saved order or results', async () => {
		const challenge = createRunChallenge();
		challenge.creatures[0]!.turns.push({
			id: ariaSecondTurnId,
			initiative: { kind: 'roll', mode: 'manual' }
		});
		challenge.runState!.initiativeResults[ariaSecondTurnId] = 8;
		challenge.runState!.generatedTurnOrder = [
			{ kind: 'turn', turnId: ariaTurnId },
			{ kind: 'turn', turnId: rookTurnId },
			{ kind: 'turn', turnId: ariaSecondTurnId },
			{ kind: 'spawn' }
		];
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);

		const visibility = (await screen.findByRole('checkbox', {
			name: 'Hidden from viewers: Aria'
		})) as HTMLInputElement;
		expect(visibility.checked).toBe(false);
		await fireEvent.click(visibility);

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.creatures[0]?.isHidden).toBe(true);
			expect(saved?.runState?.generatedTurnOrder).toEqual(challenge.runState?.generatedTurnOrder);
			expect(saved?.runState?.initiativeResults).toEqual(challenge.runState?.initiativeResults);
		});

		const savedOrder = screen.getByRole('list', { name: 'Generated turn order' });
		const items = within(savedOrder).getAllByRole('listitem');
		expect(items.map((item) => item.querySelector('h2')?.textContent)).toEqual([
			'Aria - Turn 1',
			'Rook',
			'Aria - Turn 2',
			'Spawn'
		]);
		const ariaItems = items.filter((item) =>
			item.querySelector('h2')?.textContent?.startsWith('Aria')
		);
		for (const item of ariaItems) {
			expect(item.textContent).toContain('Hidden');
			expect(item.querySelector('.turn-order-card-tone')?.classList.contains('is-hidden')).toBe(
				true
			);
		}
		expect(items[1]?.textContent).not.toContain('Hidden');
		expect(items[1]?.querySelector('.turn-order-card-tone')?.classList.contains('is-hidden')).toBe(
			false
		);

		cleanup();
		render(turnOrderPage);
		const restoredVisibility = (await screen.findByRole('checkbox', {
			name: 'Hidden from viewers: Aria'
		})) as HTMLInputElement;
		expect(restoredVisibility.checked).toBe(true);

		await fireEvent.click(restoredVisibility);
		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.creatures[0]?.isHidden).toBe(false);
		});
		expect(screen.getByRole('list', { name: 'Generated turn order' }).textContent).not.toContain(
			'Hidden'
		);
	});

	it('restores a saved order and recalculates without changing initiative results', async () => {
		const challenge = createRunChallenge();
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);

		expect(await screen.findByRole('heading', { level: 1, name: 'Turn order' })).toBeTruthy();
		expect(await screen.findByText('Ashen Company')).toBeTruthy();
		expect(document.title).toBe('Turn order | Soulstone Initiative Tracker');
		const savedOrder = screen.getByRole('list', { name: 'Generated turn order' });
		expect(
			within(savedOrder)
				.getAllByRole('listitem')
				.map((item) => item.querySelector('h2')?.textContent)
		).toEqual(['Aria', 'Rook', 'Spawn']);
		expect(screen.queryByRole('link', { name: 'Return to roll' })).toBeNull();
		await fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.generatedTurnOrder).toEqual([
				{ kind: 'turn', turnId: rookTurnId },
				{ kind: 'turn', turnId: ariaTurnId },
				{ kind: 'spawn' }
			]);
			expect(saved?.runState?.initiativeResults).toEqual(challenge.runState?.initiativeResults);
		});
		expect(mockedGoto).not.toHaveBeenCalled();
	});

	it('shows a loading state while the challenge library is being read', () => {
		render(turnOrderPage);

		expect(screen.getByText('Loading challenge…')).toBeTruthy();
	});

	it('generates and saves an order when no saved order exists', async () => {
		const challenge = createRunChallenge();
		delete challenge.runState?.generatedTurnOrder;
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Generate turn order' }));

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.generatedTurnOrder).toEqual([
				{ kind: 'turn', turnId: rookTurnId },
				{ kind: 'turn', turnId: ariaTurnId },
				{ kind: 'spawn' }
			]);
			expect(saved?.runState?.initiativeResults).toEqual(challenge.runState?.initiativeResults);
		});
		expect(screen.getByRole('button', { name: 'Recalculate' })).toBeTruthy();
	});

	it('lists missing results and preserves the saved order without navigating away', async () => {
		const challenge = createRunChallenge();
		delete challenge.runState?.initiativeResults[ariaTurnId];
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Recalculate' }));

		const missingTurns = await screen.findByRole('list', {
			name: 'Turns missing initiative results'
		});
		expect(within(missingTurns).getByText('Aria')).toBeTruthy();
		expect(mockedGoto).not.toHaveBeenCalled();
		expect((await loadChallengeLibrary()).challenges[0]?.runState?.generatedTurnOrder).toEqual([
			{ kind: 'turn', turnId: ariaTurnId },
			{ kind: 'turn', turnId: rookTurnId },
			{ kind: 'spawn' }
		]);
	});

	it('lists turns with unresolved placement rules', async () => {
		const challenge = createRunChallenge();
		challenge.runState = { initiativeResults: {} };
		challenge.creatures[0]!.turns[0]!.initiative = {
			kind: 'relative-position',
			relation: 'before',
			distance: 0,
			targetTurnId: rookTurnId
		};
		challenge.creatures[1]!.turns[0]!.initiative = {
			kind: 'relative-position',
			relation: 'before',
			distance: 0,
			targetTurnId: ariaTurnId
		};
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Generate turn order' }));

		const invalidTurns = await screen.findByRole('list', { name: 'Turns with invalid placement' });
		expect(within(invalidTurns).getByText('Aria')).toBeTruthy();
		expect(within(invalidTurns).getByText('Rook')).toBeTruthy();
	});

	it.each([
		{ kind: 'unknown', message: 'The challenge was not found.' },
		{ kind: 'unreadable', message: 'The challenge could not be loaded.' }
	] as const)('shows recovery when the challenge is $kind', async ({ kind, message }) => {
		if (kind === 'unknown') {
			mockedPage.params = { challengeId: '00000000-0000-4000-8000-000000000099' };
		} else {
			vi.stubGlobal('indexedDB', undefined);
		}

		render(turnOrderPage);

		expect(await screen.findByText(message)).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Return to home' }).getAttribute('href')).toBe('/');
	});

	it('shows a save error when generating cannot be persisted', async () => {
		const challenge = createRunChallenge();
		delete challenge.runState?.generatedTurnOrder;
		await saveChallengeToLibrary(challenge);

		render(turnOrderPage);
		const generateButton = await screen.findByRole('button', { name: 'Generate turn order' });
		vi.stubGlobal('indexedDB', undefined);
		await fireEvent.click(generateButton);

		expect(await screen.findByRole('alert')).toBeTruthy();
		expect(mockedGoto).not.toHaveBeenCalled();
	});
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
