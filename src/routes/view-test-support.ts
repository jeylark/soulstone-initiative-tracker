import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { expect } from 'vitest';
import type { Challenge, StableId } from '#lib/challenge';
import setupChallengePage from './challenges/[challengeId]/SetupPanel.svelte';

export const setupChallengeId = '00000000-0000-4000-8000-000000000001' as StableId;

export async function seedStoredChallengeLibrary(value: unknown): Promise<void> {
	const database = await new Promise<IDBDatabase>((resolve, reject) => {
		const request = globalThis.indexedDB.open('soulstone-challenge-library', 1);
		request.onupgradeneeded = () => request.result.createObjectStore('challengeLibrary');
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
	try {
		await new Promise<void>((resolve, reject) => {
			const transaction = database.transaction('challengeLibrary', 'readwrite');
			transaction.objectStore('challengeLibrary').put(value, 'current');
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
			transaction.onabort = () => reject(transaction.error);
		});
	} finally {
		database.close();
	}
}

export function createSetupChallenge(): Challenge {
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

export async function renderSetup() {
	render(setupChallengePage);
	await screen.findByRole('heading', { level: 1, name: 'Challenge setup' });
}

export function expectPageError(message: string): void {
	const alert = screen.getByRole('alert');
	expect(alert.textContent).toBe(message);
	expect(alert.closest('.error-display')).toBeTruthy();
}

export async function setRelativeTarget(
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
