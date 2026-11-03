import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import type { Component } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import savedChallengesPage from './challenges/+page.svelte';
import newChallengePage from './challenges/new/+page.svelte';
import joinSessionPage from './join/+page.svelte';

afterEach(() => {
	cleanup();
});

const views: { name: string; page: Component; heading: string }[] = [
	{ name: 'new challenge', page: newChallengePage, heading: 'New challenge' },
	{ name: 'saved challenges', page: savedChallengesPage, heading: 'Saved challenges' },
	{ name: 'join session', page: joinSessionPage, heading: 'Join a live session' }
];

describe.each(views)('$name view', ({ page, heading }) => {
	it('has a heading and a link back to the landing page', () => {
		render(page);

		expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/');
	});
});

describe('new challenge setup', () => {
	it('exposes challenge settings and initiative roll modes', () => {
		render(newChallengePage);

		expect(screen.getByRole('textbox', { name: 'Challenge name' })).toBeTruthy();
		expect(screen.getByRole('spinbutton', { name: 'Fairness weight' })).toBeTruthy();
		expect(screen.getByRole('combobox', { name: 'Character initiative' })).toBeTruthy();
		expect(screen.getByRole('combobox', { name: 'NPC initiative' })).toBeTruthy();
		expect(screen.getByRole('heading', { level: 2, name: 'Factions' })).toBeTruthy();
		expect(screen.getByRole('heading', { level: 2, name: 'Creatures' })).toBeTruthy();
	});

	it('adds faction, character, NPC type, and configured creatures', async () => {
		render(newChallengePage);

		await fireEvent.click(screen.getByRole('button', { name: 'Add faction' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC type' }));
		await fireEvent.input(screen.getByRole('textbox', { name: 'New faction name' }), {
			target: { value: 'Rivals' }
		});
		await fireEvent.input(screen.getByRole('textbox', { name: 'New NPC type name' }), {
			target: { value: 'Warden' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Save faction' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Save NPC type' }));
		await fireEvent.input(screen.getByRole('textbox', { name: 'Faction name: Rivals' }), {
			target: { value: 'Outlaws' }
		});
		await fireEvent.input(screen.getByRole('textbox', { name: 'NPC type name: Warden' }), {
			target: { value: 'Guardian' }
		});

		await fireEvent.input(screen.getByRole('textbox', { name: 'Character name' }), {
			target: { value: 'Aria' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Add character' }));

		await fireEvent.input(screen.getByRole('textbox', { name: 'NPC identifier' }), {
			target: { value: 'A' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC' }));

		const ariaCreature = screen.getByRole('group', { name: 'Aria' });
		const npcCreature = screen.getByRole('group', { name: 'Guardian A' });
		expect(ariaCreature).toBeTruthy();
		expect(npcCreature).toBeTruthy();
		expect(within(ariaCreature).getByRole('combobox', { name: 'Turn initiative' })).toBeTruthy();
		const npcInitiative = within(npcCreature).getByRole('combobox', { name: 'Turn initiative' });
		expect(npcInitiative).toBeTruthy();
		await fireEvent.change(npcInitiative, { target: { value: 'static' } });
		expect(within(npcCreature).getByRole('spinbutton', { name: 'Static initiative' })).toBeTruthy();
		await fireEvent.input(screen.getByRole('textbox', { name: 'Character name: Aria' }), {
			target: { value: 'Aria II' }
		});
		expect(screen.getByRole('group', { name: 'Aria II' })).toBeTruthy();
	});
});
