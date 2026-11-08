import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
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
		expect(characters.getByRole('list').parentElement?.parentElement?.tagName).toBe('DIV');
		expect(npcTypes.getByRole('list').parentElement?.parentElement?.tagName).toBe('DIV');
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
	});
});
