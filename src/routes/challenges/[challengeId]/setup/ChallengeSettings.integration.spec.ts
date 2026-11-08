import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadChallengeLibrary, saveChallengeToLibrary } from '#lib/challenge';
import {
	createSetupChallenge,
	createSpawnEditChallenge,
	renderSetup
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

describe('new challenge setup', () => {
	it('keeps challenge settings disabled and guarded during Spawn editing', async () => {
		await saveChallengeToLibrary(createSpawnEditChallenge());
		await renderSetup();

		const nameInput = screen.getByRole('textbox', { name: 'Challenge name' }) as HTMLInputElement;
		const fairnessInput = screen.getByRole('spinbutton', {
			name: 'Fairness weight value'
		}) as HTMLInputElement;
		expect(nameInput.matches(':disabled')).toBe(true);
		expect(fairnessInput.matches(':disabled')).toBe(true);

		await fireEvent.input(nameInput, { target: { value: 'Changed while editing' } });
		await fireEvent.input(fairnessInput, { target: { value: '7' } });
		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0]!;
			expect(saved.name).toBe('Spawn edit');
			expect(saved.fairnessWeight).toBe(3);
		});
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
});
