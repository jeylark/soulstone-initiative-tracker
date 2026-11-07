import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import rollChallengePage from '../RollPanel.svelte';
import { saveChallengeToLibrary, loadChallengeLibrary, type StableId } from '#lib/challenge';
import { createSetupChallenge, expectPageError } from '../../../view-test-support';

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
