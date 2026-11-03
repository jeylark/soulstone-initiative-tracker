import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import type { Component } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import savedChallengesPage from './challenges/+page.svelte';
import newChallengePage from './challenges/new/+page.svelte';
import joinSessionPage from './join/+page.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
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
	it('shows challenge settings, the NPC type strip, and faction board', () => {
		render(newChallengePage);

		expect(screen.getByRole('textbox', { name: 'Challenge name' })).toBeTruthy();
		expect(screen.getByRole('spinbutton', { name: 'Fairness weight' })).toBeTruthy();
		expect(screen.getByRole('combobox', { name: 'Character initiative' })).toBeTruthy();
		expect(screen.getByRole('combobox', { name: 'NPC initiative' })).toBeTruthy();
		expect(screen.getByRole('heading', { level: 2, name: 'NPC types' })).toBeTruthy();
		expect(screen.getByRole('heading', { level: 2, name: 'Factions' })).toBeTruthy();
	});

	it('adds players and NPCs from their faction panels', async () => {
		render(newChallengePage);

		await fireEvent.click(screen.getByRole('button', { name: 'Add faction' }));
		await fireEvent.input(screen.getByRole('textbox', { name: 'New faction name' }), {
			target: { value: 'Outlaws' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Save faction' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC type' }));
		await fireEvent.input(screen.getByRole('textbox', { name: 'New NPC type name' }), {
			target: { value: 'Warden' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Save NPC type' }));

		const factionPanel = screen.getByRole('region', { name: 'Outlaws' });
		await fireEvent.click(within(factionPanel).getByRole('button', { name: 'Add Player' }));
		await fireEvent.input(screen.getByRole('textbox', { name: 'Character name for Outlaws' }), {
			target: { value: 'Aria' }
		});
		await fireEvent.click(within(factionPanel).getByRole('button', { name: 'Save Player' }));

		await fireEvent.click(within(factionPanel).getByRole('button', { name: 'Add NPC' }));
		await fireEvent.input(screen.getByRole('textbox', { name: 'NPC identifier for Outlaws' }), {
			target: { value: 'A' }
		});
		await fireEvent.click(within(factionPanel).getByRole('button', { name: 'Save NPC' }));

		const ariaCreature = within(factionPanel).getByRole('group', { name: 'Aria' });
		const npcCreature = within(factionPanel).getByRole('group', { name: 'Warden A' });
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
		expect(within(factionPanel).getByRole('group', { name: 'Aria II' })).toBeTruthy();
	});

	it('confirms removing a faction and its creatures', async () => {
		render(newChallengePage);

		await fireEvent.click(screen.getByRole('button', { name: 'Add faction' }));
		await fireEvent.input(screen.getByRole('textbox', { name: 'New faction name' }), {
			target: { value: 'Outlaws' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Save faction' }));

		const factionPanel = screen.getByRole('region', { name: 'Outlaws' });
		await fireEvent.click(within(factionPanel).getByRole('button', { name: 'Add Player' }));
		await fireEvent.input(screen.getByRole('textbox', { name: 'Character name for Outlaws' }), {
			target: { value: 'Aria' }
		});
		await fireEvent.click(within(factionPanel).getByRole('button', { name: 'Save Player' }));

		const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
		await fireEvent.click(screen.getByRole('button', { name: 'Remove faction Outlaws' }));
		expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('Remove faction "Outlaws"'));
		expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('1 creature'));
		expect(screen.getByRole('group', { name: 'Aria' })).toBeTruthy();

		confirmation.mockReturnValue(true);
		await fireEvent.click(screen.getByRole('button', { name: 'Remove faction Outlaws' }));
		expect(screen.queryByRole('region', { name: 'Outlaws' })).toBeNull();
		expect(screen.queryByRole('group', { name: 'Aria' })).toBeNull();
	});

	it('confirms removing an NPC type and its creatures', async () => {
		render(newChallengePage);

		await fireEvent.click(screen.getByRole('button', { name: 'Add faction' }));
		await fireEvent.input(screen.getByRole('textbox', { name: 'New faction name' }), {
			target: { value: 'Outlaws' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Save faction' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC type' }));
		await fireEvent.input(screen.getByRole('textbox', { name: 'New NPC type name' }), {
			target: { value: 'Warden' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Save NPC type' }));

		const factionPanel = screen.getByRole('region', { name: 'Outlaws' });
		await fireEvent.click(within(factionPanel).getByRole('button', { name: 'Add NPC' }));
		await fireEvent.input(screen.getByRole('textbox', { name: 'NPC identifier for Outlaws' }), {
			target: { value: 'A' }
		});
		await fireEvent.click(within(factionPanel).getByRole('button', { name: 'Save NPC' }));

		const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
		await fireEvent.click(screen.getByRole('button', { name: 'Remove NPC type Warden' }));
		expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('Remove NPC type "Warden"'));
		expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('1 NPC'));
		expect(screen.getByRole('group', { name: 'Warden A' })).toBeTruthy();

		confirmation.mockReturnValue(true);
		await fireEvent.click(screen.getByRole('button', { name: 'Remove NPC type Warden' }));
		expect(screen.queryByRole('group', { name: 'Warden A' })).toBeNull();
		expect(screen.queryByRole('textbox', { name: 'NPC type name: Warden' })).toBeNull();
	});
});
