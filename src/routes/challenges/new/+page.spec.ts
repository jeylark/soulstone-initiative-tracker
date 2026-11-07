import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import newChallengeEntryPage from './+page.svelte';
import { saveChallengeToLibrary, loadChallengeLibrary } from '#lib/challenge';
import { createSetupChallenge } from '../../view-test-support';

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
