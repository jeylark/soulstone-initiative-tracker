import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import challengePage from './+page.svelte';
import { loadChallengeLibrary, saveChallengeToLibrary } from '#lib/challenge';
import { createSetupChallenge } from '../../view-test-support';

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
	await saveChallengeToLibrary(challenge);
	mockedPage.params = { challengeId: challenge.id };
});

describe('challenge workflow tabs', () => {
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
