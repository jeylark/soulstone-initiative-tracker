import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import challengePage from './+page.svelte';
import { loadChallengeLibrary, saveChallengeToLibrary } from '#lib/challenge';
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
});
