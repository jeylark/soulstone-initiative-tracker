import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Challenge, StableId } from '#lib/challenge';
import { createSetupChallenge } from '../view-test-support';
import ChallengeCard from './ChallengeCard.svelte';

afterEach(() => {
	cleanup();
});

const factionId = '00000000-0000-4000-8000-000000000002' as StableId;
const goblinTypeId = '00000000-0000-4000-8000-000000000010' as StableId;

function createDetailedChallenge(): Challenge {
	return {
		...createSetupChallenge(),
		name: 'Ashen Company',
		updatedAt: new Date('2026-03-04T12:30:00.000Z'),
		npcTypes: [
			{ id: goblinTypeId, name: 'Goblin', initiativeStat: 2 },
			{ id: '00000000-0000-4000-8000-000000000011' as StableId, name: 'Ogre', initiativeStat: 1 }
		],
		creatures: [
			{
				id: '00000000-0000-4000-8000-000000000020' as StableId,
				kind: 'character',
				name: 'Mira',
				factionId,
				isHidden: false,
				turns: []
			},
			{
				id: '00000000-0000-4000-8000-000000000021' as StableId,
				kind: 'character',
				name: 'Tobin',
				factionId,
				isHidden: false,
				turns: []
			},
			{
				id: '00000000-0000-4000-8000-000000000022' as StableId,
				kind: 'npc',
				creatureTypeId: goblinTypeId,
				identifier: 'Goblin A',
				factionId,
				isHidden: false,
				turns: []
			}
		]
	};
}

describe('ChallengeCard', () => {
	it('fills the height of its layout cell', () => {
		render(ChallengeCard, { challenge: createSetupChallenge() });

		const card = screen.getByRole('heading', { name: 'Untitled challenge' }).closest('.card');
		expect(card?.classList.contains('card--full-height')).toBe(true);
	});

	it('marks a challenge with a generated order as running and uses the accent color', () => {
		const challenge = createSetupChallenge();
		challenge.runState = { initiativeResults: {}, generatedTurnOrder: [{ kind: 'spawn' }] };
		render(ChallengeCard, { challenge });

		const status = screen.getByText('Running');
		const card = status.closest('.card');
		expect(card?.classList.contains('card--accented')).toBe(true);
		expect(card?.style.getPropertyValue('--card-accent-color')).toBe('var(--color-accent)');
	});

	it('marks a challenge without a generated order as not running and uses the warning color', () => {
		const challenge = createSetupChallenge();
		render(ChallengeCard, { challenge });

		const status = screen.getByText('Not running');
		const card = status.closest('.card');
		expect(card?.classList.contains('card--accented')).toBe(true);
		expect(card?.style.getPropertyValue('--card-accent-color')).toBe('var(--color-warning)');
	});

	it('does not count initiative results without a generated order as running', () => {
		const challenge = createSetupChallenge();
		challenge.runState = { initiativeResults: {} };
		render(ChallengeCard, { challenge });

		expect(screen.getByText('Not running')).toBeTruthy();
		expect(screen.queryByText('Running')).toBeNull();
	});

	it('shows the name, modified date, PCs, and NPCs in separate rows', () => {
		const challenge = createDetailedChallenge();
		render(ChallengeCard, { challenge });

		expect(screen.getByRole('heading', { level: 3, name: 'Ashen Company' })).toBeTruthy();
		const time = document.querySelector('time');
		expect(time?.getAttribute('datetime')).toBe('2026-03-04T12:30:00.000Z');
		expect(time?.textContent).toBe(challenge.updatedAt.toLocaleDateString());
		expect(screen.queryByText('Last modified')).toBeNull();
		expect(screen.getByRole('link', { name: 'Load Ashen Company' })).toBeTruthy();

		const characters = within(screen.getByRole('list', { name: 'PCs' }));
		expect(characters.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
			'Mira',
			'Tobin'
		]);
		const npcTypes = within(screen.getByRole('list', { name: 'NPCs' }));
		expect(npcTypes.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
			'Goblin',
			'Ogre'
		]);

		expect(
			time?.parentElement?.contains(screen.getByRole('link', { name: 'Load Ashen Company' }))
		).toBe(true);
		expect(time?.parentElement?.firstElementChild).toBe(time);
		expect(screen.getByRole('list', { name: 'PCs' }).parentElement?.parentElement?.tagName).toBe(
			'DIV'
		);
		expect(screen.getByRole('list', { name: 'NPCs' }).parentElement?.parentElement?.tagName).toBe(
			'DIV'
		);
	});

	it('falls back for an unnamed challenge without characters or NPC types', () => {
		render(ChallengeCard, { challenge: createSetupChallenge() });

		expect(screen.getByRole('heading', { level: 3, name: 'Untitled challenge' })).toBeTruthy();
		expect(screen.queryByRole('list')).toBeNull();
		expect(screen.getAllByText('None')).toHaveLength(2);
	});

	it('offers a Load link to the challenge', () => {
		const challenge = createDetailedChallenge();
		render(ChallengeCard, { challenge });

		const load = screen.getByRole('link', { name: 'Load Ashen Company' });
		expect(load.textContent?.trim()).toBe('Load');
		expect(load.getAttribute('href')).toBe(`/challenges/${challenge.id}`);
		const group = load.closest('.button-group');
		expect(group).not.toBeNull();
		expect(
			screen.getByRole('button', { name: 'Copy Ashen Company' }).closest('.button-group')
		).toBe(group);
	});

	it('offers a Copy button and calls the parent action', async () => {
		const onCopy = vi.fn();
		render(ChallengeCard, {
			challenge: createDetailedChallenge(),
			isCopyDisabled: false,
			onCopy
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Copy Ashen Company' }));

		expect(onCopy).toHaveBeenCalledOnce();
	});

	it('disables Copy while another library action is active', () => {
		render(ChallengeCard, {
			challenge: createDetailedChallenge(),
			isCopyDisabled: true,
			onCopy: vi.fn()
		});

		expect(
			screen.getByRole('button', { name: 'Copy Ashen Company' }).hasAttribute('disabled')
		).toBe(true);
	});
});
