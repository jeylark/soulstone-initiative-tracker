import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import challengePage from './+page.svelte';
import { loadChallengeLibrary, saveChallengeToLibrary } from '#lib/challenge';
import { ariaTurnId, rookTurnId, createRunChallenge } from './run/run-test-support';
import { createSetupChallenge, seedStoredChallengeLibrary } from '../../view-test-support';

const { mockedPage } = vi.hoisted(() => ({
	mockedPage: { params: {} as Record<string, string> }
}));

vi.mock('$app/state', () => ({ page: mockedPage }));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

beforeEach(async () => {
	vi.stubGlobal('indexedDB', new IDBFactory());
	const challenge = createSetupChallenge();
	challenge.name = 'Tab navigation';
	await saveChallengeToLibrary(challenge);
	mockedPage.params = { challengeId: challenge.id };
});

describe('challenge workflow tabs', () => {
	it('downloads the challenge as a versioned file with its current run state', async () => {
		const challenge = createRunChallenge();
		challenge.name = 'Saved encounter';
		await saveChallengeToLibrary(challenge);

		const createObjectUrl = vi.fn<typeof URL.createObjectURL>(() => 'blob:challenge');
		const revokeObjectUrl = vi.fn();
		const urlConstructor = class extends URL {};
		Reflect.set(urlConstructor, 'createObjectURL', createObjectUrl);
		Reflect.set(urlConstructor, 'revokeObjectURL', revokeObjectUrl);
		vi.stubGlobal('URL', urlConstructor);
		vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

		render(challengePage);
		await fireEvent.click(await screen.findByRole('button', { name: 'Download' }));

		expect(createObjectUrl).toHaveBeenCalledOnce();
		const downloadedBlob = createObjectUrl.mock.calls[0]?.[0];
		assert(downloadedBlob instanceof Blob);
		const downloadedLibrary = JSON.parse(await downloadedBlob.text());
		expect(downloadedLibrary).toMatchObject({
			formatVersion: 1,
			challenges: [
				{
					id: challenge.id,
					name: 'Saved encounter',
					runState: {
						initiativeResults: { [ariaTurnId]: 6, [rookTurnId]: 12 },
						generatedTurnOrder: [
							{ kind: 'turn', turnId: ariaTurnId },
							{ kind: 'turn', turnId: rookTurnId },
							{ kind: 'spawn' }
						]
					}
				}
			]
		});
		expect(revokeObjectUrl).toHaveBeenCalledWith('blob:challenge');
	});

	it('loads a healthy challenge despite an unrelated unreadable record', async () => {
		const challenge = { ...createSetupChallenge(), name: 'Healthy' };
		await seedStoredChallengeLibrary({ formatVersion: 1, challenges: [null, challenge] });
		render(challengePage);
		expect(await screen.findByRole('textbox', { name: 'Challenge name' })).toBeTruthy();
		expect(screen.getByRole('tab', { name: 'Roll' }).getAttribute('aria-disabled')).toBe('false');
	});

	it('reports the requested unreadable challenge rather than claiming it is missing', async () => {
		const challenge = createSetupChallenge();
		await seedStoredChallengeLibrary({
			formatVersion: 1,
			challenges: [{ ...challenge, creatures: null }]
		});
		render(challengePage);
		expect(await screen.findByText('The challenge could not be loaded.')).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Display error details' }));
		expect(screen.getByText(/Expected an array/).textContent).toContain(
			'$.challenges[0].creatures'
		);
	});

	it('blocks Roll and Run for invalid saved progress even if setup fields are valid', async () => {
		const challenge = {
			...createSetupChallenge(),
			name: 'Progress errors',
			runState: { initiativeResults: {}, spawnCount: -1 }
		};
		await saveChallengeToLibrary(challenge);
		render(challengePage);
		expect((await screen.findByRole('tab', { name: 'Roll' })).getAttribute('aria-disabled')).toBe(
			'true'
		);
		expect(screen.getByRole('tab', { name: 'Run' }).getAttribute('aria-disabled')).toBe('true');
	});

	it('switches between Setup, Roll, and Run on the detail page', async () => {
		render(challengePage);

		const setupTab = await screen.findByRole('tab', { name: 'Setup' });
		expect(setupTab.getAttribute('aria-selected')).toBe('true');
		await fireEvent.click(screen.getByRole('tab', { name: 'Roll' }));
		expect(
			await screen.findByRole('heading', { level: 1, name: 'Initiative rolling' })
		).toBeTruthy();
		expect(screen.getByRole('tab', { name: 'Roll' }).getAttribute('aria-selected')).toBe('true');
		await fireEvent.click(screen.getByRole('tab', { name: 'Run' }));
		expect(await screen.findByRole('heading', { level: 1, name: 'Turn order' })).toBeTruthy();
		expect(screen.getByRole('tab', { name: 'Run' }).getAttribute('aria-selected')).toBe('true');
	});

	it('keeps workflow navigation available after the challenge starts', async () => {
		const challenge = createSetupChallenge();
		challenge.name = 'Running challenge';
		challenge.runState = {
			initiativeResults: {},
			generatedTurnOrder: [{ kind: 'spawn' }]
		};
		await saveChallengeToLibrary(challenge);

		render(challengePage);

		const challengeName = (await screen.findByRole('textbox', {
			name: 'Challenge name'
		})) as HTMLInputElement;
		expect(challengeName.matches(':disabled')).toBe(true);
		for (const tabName of ['Roll', 'Run']) {
			expect(screen.getByRole('tab', { name: tabName }).getAttribute('aria-disabled')).toBe(
				'false'
			);
		}

		await fireEvent.click(screen.getByRole('tab', { name: 'Roll' }));
		expect(
			await screen.findByRole('heading', { level: 1, name: 'Initiative rolling' })
		).toBeTruthy();
		await fireEvent.click(screen.getByRole('tab', { name: 'Run' }));
		expect(await screen.findByRole('heading', { level: 1, name: 'Turn order' })).toBeTruthy();
	});

	it('saves Setup edits before switching tabs and restores them on return', async () => {
		render(challengePage);
		await screen.findByRole('textbox', { name: 'Challenge name' });
		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'One session' }
		});
		await fireEvent.click(screen.getByRole('tab', { name: 'Roll' }));

		await waitFor(async () => {
			expect((await loadChallengeLibrary()).challenges[0]?.name).toBe('One session');
		});
		await fireEvent.click(screen.getByRole('tab', { name: 'Setup' }));
		const restoredInput = await screen.findByRole('textbox', { name: 'Challenge name' });
		expect((restoredInput as HTMLInputElement).value).toBe('One session');
	});

	it('keeps the user in Setup when setup values are invalid', async () => {
		const invalidChallenge = createSetupChallenge();
		await saveChallengeToLibrary(invalidChallenge);
		render(challengePage);

		const rollTab = await screen.findByRole('tab', { name: 'Roll' });
		expect(rollTab.getAttribute('aria-disabled')).toBe('true');
		await fireEvent.click(rollTab);

		expect(screen.getByRole('heading', { level: 1, name: 'Challenge setup' })).toBeTruthy();
		expect(rollTab.getAttribute('aria-selected')).toBe('false');

		const runTab = screen.getByRole('tab', { name: 'Run' });
		expect(runTab.getAttribute('aria-disabled')).toBe('true');
		await fireEvent.click(runTab);
		expect(screen.getByRole('heading', { level: 1, name: 'Challenge setup' })).toBeTruthy();
	});

	it('supports keyboard navigation between tabs', async () => {
		render(challengePage);
		const setupTab = await screen.findByRole('tab', { name: 'Setup' });
		await fireEvent.keyDown(setupTab, { key: 'ArrowRight' });

		const rollTab = screen.getByRole('tab', { name: 'Roll' });
		expect(
			await screen.findByRole('heading', { level: 1, name: 'Initiative rolling' })
		).toBeTruthy();
		await waitFor(() => expect(rollTab.getAttribute('aria-selected')).toBe('true'));
		expect(rollTab).toBe(document.activeElement);
	});

	it('explains when the requested challenge does not exist', async () => {
		mockedPage.params = { challengeId: '00000000-0000-4000-8000-000000000099' };
		render(challengePage);

		expect(await screen.findByRole('alert')).toBeTruthy();
		expect(screen.getByText('The challenge was not found.')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Return to challenges' }).getAttribute('href')).toBe(
			'/challenges'
		);
	});

	it('opens Setup after Edit Challenge saves the editing state', async () => {
		const challenge = createRunChallenge();
		challenge.runState!.generatedTurnOrder = [{ kind: 'spawn' }];
		await saveChallengeToLibrary(challenge);
		mockedPage.params = { challengeId: challenge.id };
		render(challengePage);

		await fireEvent.click(await screen.findByRole('tab', { name: 'Run' }));
		await fireEvent.click(await screen.findByRole('button', { name: 'Edit Challenge' }));

		expect(await screen.findByRole('heading', { level: 1, name: 'Challenge setup' })).toBeTruthy();
		const saved = (await loadChallengeLibrary()).challenges.find(
			(item) => item.id === challenge.id
		);
		expect(saved?.runState?.spawnEdit).toEqual({
			newCreatureIds: [],
			newNpcTypeIds: [],
			newTurnIds: [],
			lockedInitiativeTurnIds: [ariaTurnId, rookTurnId]
		});
	});
});

describe('Spawn editing workflow', () => {
	async function openSpawnChallenge(spawnCount = 1) {
		const challenge = createRunChallenge();
		challenge.runState!.generatedTurnOrder = [{ kind: 'spawn' }];
		challenge.runState!.spawnCount = spawnCount;
		await saveChallengeToLibrary(challenge);
		mockedPage.params = { challengeId: challenge.id };
		render(challengePage);
		return challenge;
	}

	async function savedRunState(challengeId: string) {
		return (await loadChallengeLibrary()).challenges.find((item) => item.id === challengeId)
			?.runState;
	}

	async function startEditingAndAddPlayer() {
		await fireEvent.click(await screen.findByRole('tab', { name: 'Run' }));
		await fireEvent.click(await screen.findByRole('button', { name: 'Edit Challenge' }));
		await screen.findByRole('heading', { level: 1, name: 'Challenge setup' });
		const players = screen.getByRole('group', { name: 'Players' });
		await fireEvent.click(within(players).getByRole('button', { name: 'Add Player' }));
		await screen.findByRole('textbox', { name: 'Character name: Player 1' });
	}

	function button(name: string): HTMLButtonElement {
		return screen.getByRole('button', { name }) as HTMLButtonElement;
	}

	it('edits at Spawn, recalculates, relocks, and advances the count once', async () => {
		const challenge = await openSpawnChallenge();
		await startEditingAndAddPlayer();

		const aria = screen.getByRole('textbox', { name: 'Character name: Aria' });
		expect((aria as HTMLInputElement).disabled).toBe(true);
		expect(
			(screen.getByRole('textbox', { name: 'Character name: Player 1' }) as HTMLInputElement)
				.disabled
		).toBe(false);

		await fireEvent.click(screen.getByRole('tab', { name: 'Roll' }));
		const inputs = await screen.findAllByRole('spinbutton', { name: /^Initiative for / });
		const ariaInput = screen.getByRole('spinbutton', { name: 'Initiative for Aria' });
		expect((ariaInput as HTMLInputElement).disabled).toBe(true);
		const newInput = inputs.find((input) => !(input as HTMLInputElement).disabled)!;
		await fireEvent.input(newInput, { target: { value: '15' } });
		await waitFor(async () => {
			const results = (await savedRunState(challenge.id))?.initiativeResults ?? {};
			expect(Object.values(results)).toContain(15);
		});

		await fireEvent.click(screen.getByRole('tab', { name: 'Run' }));
		await screen.findByRole('heading', { level: 1, name: 'Turn order' });
		expect(button('Next turn').disabled).toBe(true);
		await fireEvent.click(button('Calculate Turn Order'));

		await waitFor(async () => {
			const runState = await savedRunState(challenge.id);
			expect(runState?.spawnEdit).toBeUndefined();
			expect(runState?.spawnCount).toBe(1);
			expect(runState?.generatedTurnOrder?.[0]).toEqual({ kind: 'spawn' });
		});
		expect(button('Next turn').disabled).toBe(false);
		expect(button('Edit Challenge').disabled).toBe(false);

		await fireEvent.click(screen.getByRole('tab', { name: 'Setup' }));
		expect(
			(await screen.findByRole('textbox', { name: 'Challenge name' })).matches(':disabled')
		).toBe(true);
		expect(
			(screen.getByRole('textbox', { name: 'Character name: Player 1' }) as HTMLInputElement)
				.disabled
		).toBe(true);
		await fireEvent.click(screen.getByRole('tab', { name: 'Roll' }));
		const lockedInputs = await screen.findAllByRole('spinbutton', { name: /^Initiative for / });
		expect(lockedInputs.every((input) => (input as HTMLInputElement).disabled)).toBe(true);

		await fireEvent.click(screen.getByRole('tab', { name: 'Run' }));
		await screen.findByRole('heading', { level: 1, name: 'Turn order' });
		await fireEvent.click(button('Next turn'));
		await waitFor(async () => expect((await savedRunState(challenge.id))?.spawnCount).toBe(2));
		expect((await savedRunState(challenge.id))?.generatedTurnOrder?.at(-1)).toEqual({
			kind: 'spawn'
		});
	});

	it('keeps permissions and locks after reloading mid-edit', async () => {
		const challenge = await openSpawnChallenge();
		await startEditingAndAddPlayer();
		await waitFor(async () =>
			expect((await savedRunState(challenge.id))?.spawnEdit?.newCreatureIds).toHaveLength(1)
		);

		cleanup();
		render(challengePage);
		expect(await screen.findByRole('heading', { level: 1, name: 'Challenge setup' })).toBeTruthy();
		expect(
			(
				(await screen.findByRole('textbox', {
					name: 'Character name: Aria'
				})) as HTMLInputElement
			).disabled
		).toBe(true);
		expect(
			(screen.getByRole('textbox', { name: 'Character name: Player 1' }) as HTMLInputElement)
				.disabled
		).toBe(false);
		expect(
			(screen.getByRole('button', { name: 'Add Faction' }) as HTMLButtonElement).disabled
		).toBe(true);

		await fireEvent.click(screen.getByRole('tab', { name: 'Run' }));
		await screen.findByRole('heading', { level: 1, name: 'Turn order' });
		expect(button('Next turn').disabled).toBe(true);
		expect(button('Edit Challenge').disabled).toBe(true);
	});

	it('does not finish editing while a new turn has no initiative result', async () => {
		const challenge = await openSpawnChallenge();
		await startEditingAndAddPlayer();
		await fireEvent.click(screen.getByRole('tab', { name: 'Run' }));
		await screen.findByRole('heading', { level: 1, name: 'Turn order' });
		await fireEvent.click(button('Calculate Turn Order'));

		expect(
			await screen.findByText(
				'Turn order cannot be generated until every rolling turn has a result.'
			)
		).toBeTruthy();
		expect(button('Next turn').disabled).toBe(true);
		const runState = await savedRunState(challenge.id);
		expect(runState?.spawnEdit).toBeDefined();
		expect(runState?.spawnCount).toBe(1);
	});
});
