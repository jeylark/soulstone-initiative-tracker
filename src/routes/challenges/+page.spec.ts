import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import savedChallengesPage from './+page.svelte';
import {
	loadChallengeLibrary,
	loadChallengeLibraryWithDiagnostics,
	saveChallengeToLibrary
} from '#lib/challenge';
import { createSetupChallenge, seedStoredChallengeLibrary } from '../view-test-support';

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
	it('reports unreadable challenges alongside healthy cards and permits creation without deleting them', async () => {
		const challenge = { ...createSetupChallenge(), name: 'Healthy' };
		await seedStoredChallengeLibrary({
			formatVersion: 1,
			challenges: [{ name: 'Broken', creatures: null }, challenge]
		});
		render(savedChallengesPage);
		expect(await screen.findByRole('heading', { level: 3, name: 'Healthy' })).toBeTruthy();
		expect(screen.getByText('Some saved challenges could not be loaded.')).toBeTruthy();
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
		expect(await screen.findByText('No saved challenges yet.')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Create new challenge' })).toBeTruthy();
		expect(document.title).toBe('Challenges | Soulstone Initiative Tracker');

		await screen.findByText('No saved challenges yet.');
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
