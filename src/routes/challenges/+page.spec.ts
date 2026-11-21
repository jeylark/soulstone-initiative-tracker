import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import savedChallengesPage from './+page.svelte';
import type { DeepReadonly } from '#lib/DeepReadonly';
import {
	loadChallengeLibrary,
	loadChallengeLibraryWithDiagnostics,
	saveChallengeToLibrary,
	createChallengeLibraryJson,
	createChallengeJson,
	createUuid
} from '#lib/challenge';
import {
	createSetupChallenge,
	createSpawnEditChallenge,
	seedStoredChallengeLibrary
} from '../view-test-support';

const { mockedGoto } = vi.hoisted(() => ({ mockedGoto: vi.fn() }));

vi.mock('$app/navigation', () => ({ goto: mockedGoto }));

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.clearAllMocks();
});

beforeEach(() => {
	vi.stubGlobal('indexedDB', new IDBFactory());
});

describe('challenge hub', () => {
	async function uploadLibrary(json: string): Promise<void> {
		await fireEvent.change(screen.getByLabelText('Library JSON file'), {
			target: { files: [new File([json], 'library.json', { type: 'application/json' })] }
		});
	}

	it('merges all uploaded challenges only after confirmation and refreshes the cards', async () => {
		const local = { ...createSetupChallenge(), name: 'Local' };
		await saveChallengeToLibrary(local);
		const imported = [1, 2].map((number) => ({
			...createSetupChallenge(),
			id: createUuid(),
			name: `Imported ${number}`,
			factions: []
		}));
		render(savedChallengesPage);
		await screen.findByText('Local');
		await uploadLibrary(createChallengeLibraryJson({ formatVersion: 1, challenges: imported }));
		await screen.findByRole('button', { name: 'Import challenges' });
		const importGroup = screen
			.getByRole('button', { name: 'Import challenges' })
			.closest('.button-group');
		expect(importGroup).not.toBeNull();
		expect(screen.getByRole('button', { name: 'Cancel import' }).closest('.button-group')).toBe(
			importGroup
		);
		expect((await loadChallengeLibrary()).challenges).toEqual([local]);
		await fireEvent.click(screen.getByRole('button', { name: 'Import challenges' }));
		await screen.findByRole('heading', { name: 'Imported 2' });
		expect((await loadChallengeLibrary()).challenges).toEqual([local, ...imported]);
		expect(screen.getByRole('status').textContent).toContain('2 challenges imported');
		await vi.waitFor(() =>
			expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Upload Library' }))
		);
	});

	it('imports a single downloaded challenge through the library upload workflow', async () => {
		const challenge = createSetupChallenge();
		render(savedChallengesPage);
		await screen.findByRole('list', { name: 'Saved challenges' });
		await uploadLibrary(
			createChallengeJson({ formatVersion: 1, challenges: [challenge] }, challenge.id)
		);
		await fireEvent.click(await screen.findByRole('button', { name: 'Import challenges' }));
		await screen.findByRole('status');
		expect((await loadChallengeLibrary()).challenges).toEqual([challenge]);
	});

	it.each(['replace', 'copy', 'skip'])(
		'asks how to %s a duplicate challenge',
		async (resolution) => {
			const local = { ...createSetupChallenge(), name: 'Local' };
			const imported = { ...local, name: 'Uploaded' };
			await saveChallengeToLibrary(local);
			render(savedChallengesPage);
			await screen.findByText('Local');
			await uploadLibrary(createChallengeLibraryJson({ formatVersion: 1, challenges: [imported] }));
			const choice = await screen.findByRole('combobox', { name: 'Uploaded' });
			expect(
				screen.getByRole('button', { name: 'Import challenges' }).hasAttribute('disabled')
			).toBe(true);
			await fireEvent.change(choice, { target: { value: resolution } });
			await fireEvent.click(screen.getByRole('button', { name: 'Import challenges' }));
			await screen.findByRole('status');
			const saved = (await loadChallengeLibrary()).challenges;
			if (resolution === 'replace') expect(saved).toEqual([imported]);
			if (resolution === 'skip') expect(saved).toEqual([local]);
			if (resolution === 'copy') {
				expect(saved).toHaveLength(2);
				expect(saved[0]).toEqual(local);
				expect(saved[1]?.name).toBe('Uploaded');
				expect(saved[1]?.id).not.toBe(local.id);
				expect(saved[1]?.factions[0]?.id).not.toBe(local.factions[0]?.id);
			}
		}
	);

	it('cancels without saving and permits selecting the same file again', async () => {
		render(savedChallengesPage);
		await screen.findByRole('list', { name: 'Saved challenges' });
		const json = createChallengeLibraryJson({
			formatVersion: 1,
			challenges: [createSetupChallenge()]
		});
		await uploadLibrary(json);
		await fireEvent.click(await screen.findByRole('button', { name: 'Cancel import' }));
		await vi.waitFor(() =>
			expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Upload Library' }))
		);
		expect((await loadChallengeLibrary()).challenges).toEqual([]);
		await uploadLibrary(json);
		expect(await screen.findByRole('button', { name: 'Import challenges' })).toBeTruthy();
	});

	it.each([
		'not json',
		'{"formatVersion":99,"challenges":[]}',
		JSON.stringify({ formatVersion: 1, challenges: [createSetupChallenge(), { name: 'Broken' }] })
	])('rejects invalid uploads without changing the saved library', async (json) => {
		const local = { ...createSetupChallenge(), name: 'Local' };
		await saveChallengeToLibrary(local);
		render(savedChallengesPage);
		await screen.findByText('Local');
		await uploadLibrary(json);
		expect(await screen.findByText('The challenge library could not be uploaded.')).toBeTruthy();
		expect((await loadChallengeLibrary()).challenges).toEqual([local]);
		expect(screen.queryByRole('button', { name: 'Import challenges' })).toBeNull();
	});

	it('preserves unreadable local records while importing', async () => {
		await seedStoredChallengeLibrary({ formatVersion: 1, challenges: [{ name: 'Broken' }] });
		render(savedChallengesPage);
		await screen.findByRole('list', { name: 'Saved challenges' });
		await uploadLibrary(
			createChallengeLibraryJson({ formatVersion: 1, challenges: [createSetupChallenge()] })
		);
		await fireEvent.click(await screen.findByRole('button', { name: 'Import challenges' }));
		await screen.findByRole('status');
		const saved = await loadChallengeLibraryWithDiagnostics();
		expect(saved.library.challenges).toHaveLength(1);
		expect(saved.unreadableChallenges[0]?.name).toBe('Broken');
	});

	it('opens the file picker from the upload button', async () => {
		render(savedChallengesPage);
		await screen.findByRole('list', { name: 'Saved challenges' });
		const click = vi.spyOn(screen.getByLabelText('Library JSON file'), 'click');
		await fireEvent.click(screen.getByRole('button', { name: 'Upload Library' }));
		expect(click).toHaveBeenCalledOnce();
	});

	it('requires an independent decision for every conflict before saving a mixed merge', async () => {
		const local = [1, 2, 3].map((number) => ({
			...createSetupChallenge(),
			id: createUuid(),
			name: `Local ${number}`,
			factions: []
		}));
		await seedStoredChallengeLibrary({ formatVersion: 1, challenges: local });
		const imported = local.map((challenge, index) => ({
			...challenge,
			name: `Uploaded ${index + 1}`
		}));
		render(savedChallengesPage);
		await screen.findByText('Local 1');
		await uploadLibrary(createChallengeLibraryJson({ formatVersion: 1, challenges: imported }));
		await fireEvent.change(await screen.findByRole('combobox', { name: 'Uploaded 1' }), {
			target: { value: 'replace' }
		});
		await fireEvent.change(screen.getByRole('combobox', { name: 'Uploaded 2' }), {
			target: { value: 'copy' }
		});
		expect(screen.getByRole('button', { name: 'Import challenges' }).hasAttribute('disabled')).toBe(
			true
		);
		expect((await loadChallengeLibrary()).challenges).toEqual(local);
		await fireEvent.change(screen.getByRole('combobox', { name: 'Uploaded 3' }), {
			target: { value: 'skip' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Import challenges' }));
		await screen.findByRole('status');
		const saved = (await loadChallengeLibrary()).challenges;
		expect(saved.map(({ name }) => name)).toEqual([
			'Uploaded 1',
			'Local 2',
			'Local 3',
			'Uploaded 2'
		]);
		expect(saved[3]?.id).not.toBe(local[1]?.id);
	});

	it('preserves dates and saved progress when importing a running challenge', async () => {
		const challenge = createSpawnEditChallenge();
		render(savedChallengesPage);
		await screen.findByRole('list', { name: 'Saved challenges' });
		await uploadLibrary(createChallengeLibraryJson({ formatVersion: 1, challenges: [challenge] }));
		await fireEvent.click(await screen.findByRole('button', { name: 'Import challenges' }));
		await screen.findByRole('status');
		expect((await loadChallengeLibrary()).challenges).toEqual([challenge]);
	});

	it('offers copy or skip for an unreadable duplicate without deleting the original', async () => {
		const challenge = { ...createSetupChallenge(), name: 'Uploaded' };
		await seedStoredChallengeLibrary({
			formatVersion: 1,
			challenges: [{ id: challenge.id, name: 'Broken' }]
		});
		render(savedChallengesPage);
		await screen.findByRole('list', { name: 'Saved challenges' });
		await uploadLibrary(createChallengeLibraryJson({ formatVersion: 1, challenges: [challenge] }));
		const choice = await screen.findByRole('combobox', { name: 'Uploaded' });
		expect(screen.queryByRole('option', { name: 'Replace existing challenge' })).toBeNull();
		await fireEvent.change(choice, { target: { value: 'copy' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Import challenges' }));
		await screen.findByRole('status');
		const saved = await loadChallengeLibraryWithDiagnostics();
		expect(saved.unreadableChallenges[0]?.id).toBe(challenge.id);
		expect(saved.library.challenges[0]?.id).not.toBe(challenge.id);
	});

	it('reports file-read errors without offering an import', async () => {
		render(savedChallengesPage);
		await screen.findByRole('list', { name: 'Saved challenges' });
		const file = new File([], 'unreadable.json');
		vi.spyOn(file, 'text').mockRejectedValue(new Error('Read failed'));
		await fireEvent.change(screen.getByLabelText('Library JSON file'), {
			target: { files: [file] }
		});
		expect(await screen.findByText('The challenge library could not be uploaded.')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Import challenges' })).toBeNull();
	});

	it('retains the pending import for retry after a failed batch write', async () => {
		const local = { ...createSetupChallenge(), name: 'Local' };
		await saveChallengeToLibrary(local);
		const imported = [1, 2].map((number) => ({
			...createSetupChallenge(),
			id: createUuid(),
			name: `Imported ${number}`,
			factions: []
		}));
		render(savedChallengesPage);
		await screen.findByText('Local');
		await uploadLibrary(createChallengeLibraryJson({ formatVersion: 1, challenges: imported }));
		await screen.findByRole('button', { name: 'Import challenges' });
		const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
			throw new DOMException('Storage full', 'QuotaExceededError');
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Import challenges' }));
		await screen.findByText('The challenge library could not be uploaded.');
		expect((await loadChallengeLibrary()).challenges).toEqual([local]);
		put.mockRestore();
		await fireEvent.click(screen.getByRole('button', { name: 'Import challenges' }));
		await screen.findByRole('status');
		expect((await loadChallengeLibrary()).challenges).toEqual([local, ...imported]);
	});

	it('reports unreadable challenges alongside healthy cards and permits creation without deleting them', async () => {
		const challenge = { ...createSetupChallenge(), name: 'Healthy' };
		await seedStoredChallengeLibrary({
			formatVersion: 1,
			challenges: [{ name: 'Broken', creatures: null }, challenge]
		});
		render(savedChallengesPage);
		expect(await screen.findByRole('heading', { level: 3, name: 'Healthy' })).toBeTruthy();
		expect(screen.getByText('Some saved challenges could not be loaded.')).toBeTruthy();
		const items = screen.getAllByRole('listitem');
		expect(within(items[0]!).getByRole('button', { name: 'Create new challenge' })).toBeTruthy();
		expect(within(items[1]!).getByRole('heading', { name: 'Healthy' })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Display error details' }));
		expect(screen.getByText(/Broken/).textContent).toContain('$.challenges[0].creatures');
		await fireEvent.click(screen.getByRole('button', { name: 'Create new challenge' }));
		await vi.waitFor(() => expect(mockedGoto).toHaveBeenCalledOnce());
		const saved = await loadChallengeLibraryWithDiagnostics();
		expect(saved.library.challenges).toHaveLength(2);
		expect(saved.unreadableChallenges[0].name).toBe('Broken');
	});

	it('offers challenge creation when the library is empty', async () => {
		render(savedChallengesPage);

		expect(await screen.findByRole('heading', { level: 1, name: 'Challenges' })).toBeTruthy();
		const items = await screen.findAllByRole('listitem');
		expect(items).toHaveLength(1);
		expect(within(items[0]!).getByRole('button', { name: 'Create new challenge' })).toBeTruthy();
		expect(screen.queryByText('No saved challenges yet.')).toBeNull();
		expect(document.title).toBe('Challenges | Soulstone Initiative Tracker');

		await screen.getByRole('button', { name: 'Create new challenge' }).click();
		await vi.waitFor(() => expect(mockedGoto).toHaveBeenCalledOnce());

		const [href, options] = mockedGoto.mock.calls[0] as [string, Record<string, unknown>];
		expect(href).toMatch(/^\/challenges\/[0-9a-f-]+$/i);
		expect(options['replace']).toBe(true);
		const saved = (await loadChallengeLibrary()).challenges[0];
		expect(saved?.id).toBe(href.split('/')[2]);
		expect(saved?.creatures).toEqual([]);
	});

	it('loads a saved challenge from the library', async () => {
		const challenge = { ...createSetupChallenge(), name: 'Ashen Company' };
		await saveChallengeToLibrary(challenge);

		render(savedChallengesPage);

		expect(await screen.findByRole('heading', { level: 3, name: 'Ashen Company' })).toBeTruthy();
		const challengeLink = screen.getByRole('link', { name: 'Load Ashen Company' });
		expect(challengeLink.getAttribute('href')).toBe(`/challenges/${challenge.id}`);
	});

	it('copies setup settings, saves the new challenge, and opens its setup page', async () => {
		const source = { ...createSpawnEditChallenge(), name: 'Ashen Company' };
		await saveChallengeToLibrary(source);
		render(savedChallengesPage);
		await screen.findByRole('heading', { level: 3, name: 'Ashen Company' });

		await fireEvent.click(screen.getByRole('button', { name: 'Copy Ashen Company' }));

		await vi.waitFor(() => expect(mockedGoto).toHaveBeenCalledOnce());
		const saved = (await loadChallengeLibrary()).challenges;
		const copied = saved.find(({ id }) => id !== source.id);
		const getIds = (challenge: DeepReadonly<(typeof saved)[number]>) => [
			challenge.id,
			...challenge.factions.map(({ id }) => id),
			...challenge.npcTypes.map(({ id }) => id),
			...challenge.creatures.flatMap((creature) => [
				creature.id,
				...creature.turns.map(({ id }) => id)
			])
		];

		expect(saved).toHaveLength(2);
		expect(saved.find(({ id }) => id === source.id)).toEqual(source);
		expect(copied?.name).toBe(source.name);
		expect(copied?.creatures[0]).toMatchObject({
			kind: 'character',
			name: 'Aria',
			factionId: copied?.factions[0]?.id,
			isHidden: false,
			turns: [{ initiative: { kind: 'roll', mode: 'manual' } }]
		});
		expect(copied).not.toHaveProperty('runState');
		expect(getIds(copied!).some((id) => getIds(source).includes(id))).toBe(false);
		const [navigationPath, navigationOptions] = mockedGoto.mock.calls[0] as [
			string,
			Record<string, unknown>
		];
		expect(navigationPath).toBe(`/challenges/${copied?.id}`);
		expect(navigationOptions['replace']).toBe(true);
	});

	it('downloads the complete challenge library', async () => {
		const challenge = { ...createSetupChallenge(), name: 'Ashen Company' };
		await saveChallengeToLibrary(challenge);
		const createObjectUrl = vi.fn(() => 'blob:backup');
		const revokeObjectUrl = vi.fn();
		const urlConstructor = class extends URL {};
		Reflect.set(urlConstructor, 'createObjectURL', createObjectUrl);
		Reflect.set(urlConstructor, 'revokeObjectURL', revokeObjectUrl);
		vi.stubGlobal('URL', urlConstructor);
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

		render(savedChallengesPage);
		await screen.findByRole('heading', { level: 3, name: 'Ashen Company' });
		await fireEvent.click(screen.getByRole('button', { name: 'Download Library' }));

		await vi.waitFor(() => expect(createObjectUrl).toHaveBeenCalledOnce());
		expect(click).toHaveBeenCalledOnce();
		expect(revokeObjectUrl).toHaveBeenCalledWith('blob:backup');
	});

	it('shows a recoverable error when the library download fails', async () => {
		vi.stubGlobal('indexedDB', undefined);

		render(savedChallengesPage);
		await screen.findByRole('button', { name: 'Download Library' });
		await fireEvent.click(screen.getByRole('button', { name: 'Download Library' }));

		expect(await screen.findByText('The challenge library could not be downloaded.')).toBeTruthy();
	});

	it('shows a recoverable storage error', async () => {
		vi.stubGlobal('indexedDB', undefined);

		render(savedChallengesPage);

		expect(await screen.findByRole('alert')).toBeTruthy();
		expect(screen.getByText('The saved challenges could not be loaded.')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
	});

	it('shows create-save error details and a retry action', async () => {
		vi.stubGlobal('indexedDB', undefined);

		render(savedChallengesPage);
		await screen.findByText('The saved challenges could not be loaded.');
		await fireEvent.click(screen.getByRole('button', { name: 'Create new challenge' }));

		await screen.findByText('The new challenge could not be saved.');
		const detailButtons = screen.getAllByRole('button', { name: 'Display error details' });
		expect(detailButtons).toHaveLength(1);
		await fireEvent.click(detailButtons[0]!);
		expect(
			screen
				.getByText('ChallengeLibraryStorageError: IndexedDB is not available.')
				.hasAttribute('hidden')
		).toBe(false);
		expect(screen.getAllByRole('button', { name: 'Try again' })).toHaveLength(1);
	});
});
