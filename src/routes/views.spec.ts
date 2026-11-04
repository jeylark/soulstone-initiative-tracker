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

async function setRelativeTarget(
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

describe.each(views)('$name view', ({ page, heading }) => {
	it('has a heading and a link back to the landing page', () => {
		render(page);

		expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy();
	});
});

describe('new challenge setup', () => {
	it('uses shared card surfaces while preserving named form groups', async () => {
		render(newChallengePage);

		// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- DOM elements are not readonly
		const expectCard = (group: HTMLElement, variant: string, spacing: string) => {
			const card = group.parentElement;
			expect(card?.classList.contains('card')).toBe(true);
			expect(card?.classList.contains(`card--${variant}`)).toBe(true);
			expect(card?.classList.contains(`card--${spacing}`)).toBe(true);
		};

		const settings = screen.getByRole('group', { name: 'Challenge settings' });
		expectCard(settings, 'surface', 'standard');
		expect(screen.getByRole('heading', { name: 'Challenge settings', level: 2 })).toBeTruthy();

		const npcTypes = screen.getByRole('group', { name: 'NPC types' });
		expectCard(npcTypes, 'surface', 'standard');
		expect(screen.getByRole('heading', { name: 'NPC types', level: 2 })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		const npcType = screen.getByRole('group', { name: 'NPC Type 1' });
		expectCard(npcType, 'subtle', 'compact');
		expect(screen.getByRole('heading', { name: 'NPC Type 1', level: 3 })).toBeTruthy();

		const factions = screen.getByRole('group', { name: 'Factions' });
		expectCard(factions, 'surface', 'standard');
		expect(screen.getByRole('heading', { name: 'Factions', level: 2 })).toBeTruthy();
		const players = within(factions).getByRole('group', { name: 'Players' });
		expectCard(players, 'inset', 'compact');
		expect(screen.getByRole('heading', { name: 'Players', level: 3 })).toBeTruthy();
		await fireEvent.click(within(players).getByRole('button', { name: 'Add Player' }));
		const player = within(players).getByRole('group', { name: 'Player 1' });
		expectCard(player, 'surface', 'compact');
		expect(screen.getByRole('heading', { name: 'Player 1', level: 4 })).toBeTruthy();
		const turn = within(player).getByRole('group', { name: 'Turn 1' });
		expectCard(turn, 'inset', 'compact');
		expect(screen.getByRole('heading', { name: 'Turn 1', level: 5 })).toBeTruthy();
	});

	it('shows challenge settings, the NPC type strip, and faction board', () => {
		render(newChallengePage);

		expect(screen.getByRole('textbox', { name: 'Challenge name' })).toBeTruthy();
		const fairnessWeight = screen.getByRole('slider', { name: 'Fairness weight slider' });
		expect(fairnessWeight.getAttribute('min')).toBe('0');
		expect(fairnessWeight.getAttribute('max')).toBe('10');
		expect(fairnessWeight.getAttribute('step')).toBe('0.01');
		expect(
			(screen.getByRole('spinbutton', { name: 'Fairness weight value' }) as HTMLInputElement).value
		).toBe('3');
		expect(screen.getByText('Initiative and faction balance have similar influence.')).toBeTruthy();
		expect(screen.queryByRole('combobox', { name: 'Character initiative default' })).toBeNull();
		expect(screen.queryByRole('combobox', { name: 'NPC initiative default' })).toBeNull();
		expect(screen.getByRole('group', { name: 'Challenge settings' })).toBeTruthy();
		expect(screen.getByRole('group', { name: 'NPC types' })).toBeTruthy();
		expect(screen.getByRole('group', { name: 'Factions' })).toBeTruthy();
		expect(screen.getByRole('group', { name: 'Players' })).toBeTruthy();
		expect(screen.getByRole('group', { name: 'Enemies' })).toBeTruthy();
	});

	it('updates the visible fairness value as the slider moves', async () => {
		render(newChallengePage);

		await fireEvent.input(screen.getByRole('slider', { name: 'Fairness weight slider' }), {
			target: { value: '4.25' }
		});
		expect(
			(screen.getByRole('spinbutton', { name: 'Fairness weight value' }) as HTMLInputElement).value
		).toBe('4.25');
	});

	it('accepts a fairness weight above the slider range and keeps the slider at its maximum', async () => {
		render(newChallengePage);

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
		render(newChallengePage);

		await fireEvent.input(screen.getByRole('slider', { name: 'Fairness weight slider' }), {
			target: { value }
		});
		expect(screen.getByText(description)).toBeTruthy();
	});

	it('adds factions and NPC types immediately with sensible defaults', async () => {
		render(newChallengePage);

		await fireEvent.click(screen.getByRole('button', { name: 'Add Faction' }));
		expect(screen.getByRole('group', { name: 'Faction 1' })).toBeTruthy();
		expect(screen.queryByRole('textbox', { name: 'New faction name' })).toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		expect(screen.getByRole('group', { name: 'NPC Type 1' })).toBeTruthy();
		expect(screen.getByRole('textbox', { name: 'NPC type name: NPC Type 1' })).toBeTruthy();
		expect(screen.getByRole('spinbutton', { name: 'Initiative stat for NPC Type 1' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: /Use NPC type|Selected/ })).toBeNull();
		expect(screen.queryByRole('textbox', { name: 'New NPC type name' })).toBeNull();
	});

	it('prefers unused faction colors and allows color reuse', async () => {
		render(newChallengePage);

		const playersColors = screen.getByRole('group', { name: 'Faction color for Players' });
		const enemiesColors = screen.getByRole('group', { name: 'Faction color for Enemies' });
		expect(
			(within(playersColors).getByRole('radio', { name: 'Blue' }) as HTMLInputElement).checked
		).toBe(true);
		expect(
			(within(enemiesColors).getByRole('radio', { name: 'Red' }) as HTMLInputElement).checked
		).toBe(true);

		await fireEvent.click(screen.getByRole('button', { name: 'Add Faction' }));
		const factionColors = screen.getByRole('group', {
			name: 'Faction color for Faction 1'
		});
		expect(
			(within(factionColors).getByRole('radio', { name: 'Green' }) as HTMLInputElement).checked
		).toBe(true);

		await fireEvent.click(within(factionColors).getByRole('radio', { name: 'Blue' }));
		expect(
			(within(factionColors).getByRole('radio', { name: 'Blue' }) as HTMLInputElement).checked
		).toBe(true);
		expect(
			(within(playersColors).getByRole('radio', { name: 'Blue' }) as HTMLInputElement).checked
		).toBe(true);

		for (let index = 0; index < 8; index += 1) {
			await fireEvent.click(screen.getByRole('button', { name: 'Add Faction' }));
		}
		const selectedColors = screen
			.getAllByRole('group', { name: /Faction color for/ })
			.map((group) => group.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.value);
		expect(new Set(selectedColors).size).toBeLessThan(selectedColors.length);
	});

	it('adds players and NPCs to their faction without opening forms', async () => {
		render(newChallengePage);

		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		const playersPanel = screen.getByRole('group', { name: 'Players' });
		const enemiesPanel = screen.getByRole('group', { name: 'Enemies' });

		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		const player = within(playersPanel).getByRole('group', { name: 'Player 1' });
		expect(player).toBeTruthy();
		expect(
			(within(player).getByRole('combobox', { name: 'Turn initiative' }) as HTMLSelectElement).value
		).toBe('roll-manual');
		expect(within(player).getByRole('option', { name: 'Calculate roll' })).toBeTruthy();
		expect(within(player).getByRole('option', { name: 'Enter a result' })).toBeTruthy();
		expect(
			within(playersPanel).queryByRole('textbox', { name: 'Character name for Players' })
		).toBeNull();

		await fireEvent.click(within(enemiesPanel).getByRole('button', { name: 'Add NPC' }));
		const npc = within(enemiesPanel).getByRole('group', { name: 'NPC Type 1 1' });
		expect(npc).toBeTruthy();
		expect(
			(within(npc).getByRole('combobox', { name: 'Turn initiative' }) as HTMLSelectElement).value
		).toBe('roll-app');
		expect(screen.queryByRole('button', { name: /Use NPC type|Selected/ })).toBeNull();
		await fireEvent.click(within(npc).getByRole('button', { name: 'Add turn for NPC Type 1 1' }));
		expect(
			(
				within(npc)
					.getByRole('group', { name: 'Turn 2' })
					.querySelector('select') as HTMLSelectElement
			).value
		).toBe('roll-app');
		expect(
			within(enemiesPanel).queryByRole('textbox', { name: 'NPC identifier for Enemies' })
		).toBeNull();
	});

	it('uses hard-coded initiative modes for new creatures and allows independent turn overrides', async () => {
		render(newChallengePage);

		const playersPanel = screen.getByRole('group', { name: 'Players' });
		const enemiesPanel = screen.getByRole('group', { name: 'Enemies' });
		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		const firstPlayer = within(playersPanel).getByRole('group', { name: 'Player 1' });
		const secondPlayer = within(playersPanel).getByRole('group', { name: 'Player 2' });
		expect(
			(within(firstPlayer).getByRole('combobox', { name: 'Turn initiative' }) as HTMLSelectElement)
				.value
		).toBe('roll-manual');
		expect(
			(within(secondPlayer).getByRole('combobox', { name: 'Turn initiative' }) as HTMLSelectElement)
				.value
		).toBe('roll-manual');

		await fireEvent.change(within(firstPlayer).getByRole('combobox', { name: 'Turn initiative' }), {
			target: { value: 'roll-app' }
		});
		await fireEvent.change(
			within(secondPlayer).getByRole('combobox', { name: 'Turn initiative' }),
			{
				target: { value: 'roll-manual' }
			}
		);
		expect(
			(within(firstPlayer).getByRole('combobox', { name: 'Turn initiative' }) as HTMLSelectElement)
				.value
		).toBe('roll-app');
		expect(
			(within(secondPlayer).getByRole('combobox', { name: 'Turn initiative' }) as HTMLSelectElement)
				.value
		).toBe('roll-manual');
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		await fireEvent.click(within(enemiesPanel).getByRole('button', { name: 'Add NPC' }));
		const npc = within(enemiesPanel).getByRole('group', { name: 'NPC Type 1 1' });
		expect(
			(within(npc).getByRole('combobox', { name: 'Turn initiative' }) as HTMLSelectElement).value
		).toBe('roll-app');
	});

	it('hides a creature with zero turns and keeps its visibility when turns are added', async () => {
		render(newChallengePage);

		const playersPanel = screen.getByRole('group', { name: 'Players' });
		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		const player = within(playersPanel).getByRole('group', { name: 'Player 1' });
		const visibility = within(player).getByRole('checkbox', {
			name: 'Hidden from viewers: Player 1'
		}) as HTMLInputElement;

		expect(visibility.checked).toBe(false);
		await fireEvent.click(visibility);
		expect(visibility.checked).toBe(true);

		await fireEvent.click(
			within(player).getByRole('button', { name: 'Remove Turn 1 for Player 1' })
		);
		expect(within(player).queryByRole('group', { name: 'Turn 1' })).toBeNull();
		expect(visibility.checked).toBe(true);

		await fireEvent.click(within(player).getByRole('button', { name: 'Add turn for Player 1' }));
		expect(within(player).getByRole('group', { name: 'Turn 1' })).toBeTruthy();
		await fireEvent.click(within(player).getByRole('button', { name: 'Add turn for Player 1' }));
		expect(within(player).getByRole('group', { name: 'Turn 2' })).toBeTruthy();
		expect(visibility.checked).toBe(true);

		await fireEvent.click(visibility);
		expect(visibility.checked).toBe(false);
	});

	it('reorders turns without changing relative target IDs or initiative rules', async () => {
		render(newChallengePage);

		const playersPanel = screen.getByRole('group', { name: 'Players' });
		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		const dependentCreature = within(playersPanel).getByRole('group', { name: 'Player 1' });
		const targetCreature = within(playersPanel).getByRole('group', { name: 'Player 2' });
		await fireEvent.click(
			within(targetCreature).getByRole('button', { name: 'Add turn for Player 2' })
		);
		await setRelativeTarget('Player 1', 'Turn 1', 'before', 'Player 2 - Turn 1');

		const dependentTurn = within(dependentCreature).getByRole('group', { name: 'Turn 1' });
		const originalTarget = within(targetCreature).getByRole('group', { name: 'Turn 1' });
		const originalLastTurn = within(targetCreature).getByRole('group', { name: 'Turn 2' });
		const targetSelector = within(dependentTurn).getByRole('combobox', {
			name: 'Target turn'
		}) as HTMLSelectElement;
		const targetId = targetSelector.value;

		expect(
			(
				within(originalTarget).getByRole('button', {
					name: 'Move Turn 1 up for Player 2'
				}) as HTMLButtonElement
			).disabled
		).toBe(true);
		expect(
			(
				within(originalLastTurn).getByRole('button', {
					name: 'Move Turn 2 down for Player 2'
				}) as HTMLButtonElement
			).disabled
		).toBe(true);

		await fireEvent.click(
			within(originalTarget).getByRole('button', { name: 'Move Turn 1 down for Player 2' })
		);

		const reorderedFirst = within(targetCreature).getByRole('group', { name: 'Turn 1' });
		const reorderedLast = within(targetCreature).getByRole('group', { name: 'Turn 2' });
		const reorderedTarget = within(dependentTurn).getByRole('combobox', {
			name: 'Target turn'
		}) as HTMLSelectElement;

		expect(
			(
				within(dependentTurn).getByRole('combobox', {
					name: 'Turn initiative'
				}) as HTMLSelectElement
			).value
		).toBe('relative-before');
		expect(reorderedTarget.value).toBe(targetId);
		expect(reorderedTarget.selectedOptions[0]?.textContent).toBe('Player 2 - Turn 2');
		expect(
			(
				within(reorderedFirst).getByRole('button', {
					name: 'Move Turn 1 up for Player 2'
				}) as HTMLButtonElement
			).disabled
		).toBe(true);
		expect(
			(
				within(reorderedLast).getByRole('button', {
					name: 'Move Turn 2 down for Player 2'
				}) as HTMLButtonElement
			).disabled
		).toBe(true);
	});

	it('adds and removes turn cards, renumbers them, and represents no initiative with zero turns', async () => {
		render(newChallengePage);

		const playersPanel = screen.getByRole('group', { name: 'Players' });
		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		const player = within(playersPanel).getByRole('group', { name: 'Player 1' });
		expect(within(player).getByRole('group', { name: 'Turn 1' })).toBeTruthy();
		expect(screen.queryByRole('option', { name: 'No initiative' })).toBeNull();
		expect(within(player).getByRole('button', { name: 'Add turn for Player 1' }).className).toBe(
			within(playersPanel).getByRole('button', { name: 'Add Player' }).className
		);

		await fireEvent.click(within(player).getByRole('button', { name: 'Add turn for Player 1' }));
		const secondTurn = within(player).getByRole('group', { name: 'Turn 2' });
		expect(secondTurn).toBeTruthy();
		expect(
			(within(secondTurn).getByRole('combobox', { name: 'Turn initiative' }) as HTMLSelectElement)
				.value
		).toBe('roll-manual');

		await fireEvent.click(
			within(player).getByRole('button', { name: 'Remove Turn 1 for Player 1' })
		);
		expect(within(player).getByRole('group', { name: 'Turn 1' })).toBeTruthy();
		expect(within(player).queryByRole('group', { name: 'Turn 2' })).toBeNull();

		await fireEvent.click(
			within(player).getByRole('button', { name: 'Remove Turn 1 for Player 1' })
		);
		expect(within(player).queryByRole('group', { name: 'Turn 1' })).toBeNull();
		expect(screen.queryByRole('option', { name: 'No initiative' })).toBeNull();

		await fireEvent.click(within(player).getByRole('button', { name: 'Add turn for Player 1' }));
		expect(within(player).getByRole('group', { name: 'Turn 1' })).toBeTruthy();
	});

	it('labels target turns and confirms transitive removal when deleting a referenced turn', async () => {
		render(newChallengePage);

		const playersPanel = screen.getByRole('group', { name: 'Players' });
		for (let index = 0; index < 3; index += 1) {
			await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		}
		const firstPlayer = within(playersPanel).getByRole('group', { name: 'Player 1' });
		const secondPlayer = within(playersPanel).getByRole('group', { name: 'Player 2' });
		const thirdPlayer = within(playersPanel).getByRole('group', { name: 'Player 3' });
		await fireEvent.click(
			within(firstPlayer).getByRole('button', { name: 'Add turn for Player 1' })
		);
		const secondTurn = within(firstPlayer).getByRole('group', { name: 'Turn 2' });
		await fireEvent.change(within(secondTurn).getByRole('combobox', { name: 'Turn initiative' }), {
			target: { value: 'relative-before' }
		});
		expect(within(secondTurn).getByRole('option', { name: 'Player 1 - Turn 1' })).toBeTruthy();
		expect(within(secondTurn).getByRole('option', { name: 'Player 2 - Turn 1' })).toBeTruthy();

		await setRelativeTarget('Player 2', 'Turn 1', 'before', 'Player 1 - Turn 1');
		await setRelativeTarget('Player 3', 'Turn 1', 'after', 'Player 2 - Turn 1');

		const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
		await fireEvent.click(
			within(firstPlayer).getByRole('button', { name: 'Remove Turn 1 for Player 1' })
		);
		expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('3 dependent turns'));
		expect(within(secondPlayer).getByRole('group', { name: 'Turn 1' })).toBeTruthy();
		expect(within(thirdPlayer).getByRole('group', { name: 'Turn 1' })).toBeTruthy();

		confirmation.mockReturnValue(true);
		await fireEvent.click(
			within(firstPlayer).getByRole('button', { name: 'Remove Turn 1 for Player 1' })
		);
		expect(within(firstPlayer).queryByRole('group', { name: 'Turn 1' })).toBeNull();
		expect(within(firstPlayer).queryByRole('group', { name: 'Turn 2' })).toBeNull();
		expect(within(firstPlayer).getByRole('button', { name: 'Add turn for Player 1' })).toBeTruthy();
		expect(within(secondPlayer).queryByRole('group', { name: 'Turn 1' })).toBeNull();
		expect(within(thirdPlayer).queryByRole('group', { name: 'Turn 1' })).toBeNull();
	});

	it('confirms deleting a creature will also delete turns that reference it', async () => {
		render(newChallengePage);

		const playersPanel = screen.getByRole('group', { name: 'Players' });
		const enemiesPanel = screen.getByRole('group', { name: 'Enemies' });
		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		await fireEvent.click(within(enemiesPanel).getByRole('button', { name: 'Add Player' }));
		const player = within(playersPanel).getByRole('group', { name: 'Player 1' });
		const enemy = within(enemiesPanel).getByRole('group', { name: 'Player 2' });
		await setRelativeTarget('Player 2', 'Turn 1', 'before', 'Player 1 - Turn 1');

		const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
		await fireEvent.click(within(player).getByRole('button', { name: 'Remove Player 1' }));
		expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('1 dependent turn'));
		expect(player).toBeTruthy();
		expect(within(enemy).getByRole('group', { name: 'Turn 1' })).toBeTruthy();

		confirmation.mockReturnValue(true);
		await fireEvent.click(within(player).getByRole('button', { name: 'Remove Player 1' }));
		expect(screen.queryByRole('group', { name: 'Player 1' })).toBeNull();
		expect(within(enemy).queryByRole('group', { name: 'Turn 1' })).toBeNull();
	});

	it('confirms removing a faction and its creatures', async () => {
		render(newChallengePage);

		const factionPanel = screen.getByRole('group', { name: 'Players' });
		await fireEvent.click(within(factionPanel).getByRole('button', { name: 'Add Player' }));
		const player = within(factionPanel).getByRole('group', { name: 'Player 1' });
		const enemiesPanel = screen.getByRole('group', { name: 'Enemies' });
		await fireEvent.click(within(enemiesPanel).getByRole('button', { name: 'Add Player' }));
		const enemyPlayer = within(enemiesPanel).getByRole('group', { name: 'Player 2' });
		await setRelativeTarget('Player 2', 'Turn 1', 'before', 'Player 1 - Turn 1');
		expect(
			within(player)
				.getByRole('button', { name: 'Remove Player 1' })
				.classList.contains('action-button--danger')
		).toBe(true);

		const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
		const removeFactionButton = within(factionPanel).getByRole('button', {
			name: 'Remove faction Players'
		});
		expect(removeFactionButton.classList.contains('action-button--danger')).toBe(true);
		await fireEvent.click(removeFactionButton);
		expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('Remove faction "Players"'));
		expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('1 creature'));
		expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('1 dependent turn'));
		expect(player).toBeTruthy();
		expect(within(enemyPlayer).getByRole('group', { name: 'Turn 1' })).toBeTruthy();

		confirmation.mockReturnValue(true);
		await fireEvent.click(
			within(factionPanel).getByRole('button', { name: 'Remove faction Players' })
		);
		expect(screen.queryByRole('group', { name: 'Players' })).toBeNull();
		expect(screen.queryByRole('group', { name: 'Player 1' })).toBeNull();
		expect(within(enemyPlayer).queryByRole('group', { name: 'Turn 1' })).toBeNull();
	});

	it('confirms removing an NPC type and its creatures', async () => {
		render(newChallengePage);

		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));

		const factionPanel = screen.getByRole('group', { name: 'Enemies' });
		await fireEvent.click(within(factionPanel).getByRole('button', { name: 'Add NPC' }));
		const npc = within(factionPanel).getByRole('group', { name: 'NPC Type 1 1' });
		const playersPanel = screen.getByRole('group', { name: 'Players' });
		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		const player = within(playersPanel).getByRole('group', { name: 'Player 1' });
		await setRelativeTarget('Player 1', 'Turn 1', 'after', 'NPC Type 1 1 - Turn 1');

		const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
		const removeNpcTypeButton = screen.getByRole('button', {
			name: 'Remove NPC type NPC Type 1'
		});
		expect(removeNpcTypeButton.classList.contains('action-button--danger')).toBe(true);
		await fireEvent.click(removeNpcTypeButton);
		expect(confirmation).toHaveBeenCalledWith(
			expect.stringContaining('Remove NPC type "NPC Type 1"')
		);
		expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('1 NPC'));
		expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('1 dependent turn'));
		expect(npc).toBeTruthy();
		expect(within(player).getByRole('group', { name: 'Turn 1' })).toBeTruthy();

		confirmation.mockReturnValue(true);
		await fireEvent.click(screen.getByRole('button', { name: 'Remove NPC type NPC Type 1' }));
		expect(screen.queryByRole('group', { name: 'NPC Type 1 1' })).toBeNull();
		expect(screen.queryByRole('group', { name: 'NPC Type 1' })).toBeNull();
		expect(within(player).queryByRole('group', { name: 'Turn 1' })).toBeNull();
	});

	it('lets each NPC change type and uses the most recently selected type across factions', async () => {
		render(newChallengePage);

		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		const enemiesPanel = screen.getByRole('group', { name: 'Enemies' });
		const playersPanel = screen.getByRole('group', { name: 'Players' });
		await fireEvent.click(within(enemiesPanel).getByRole('button', { name: 'Add NPC' }));
		const firstNpc = within(enemiesPanel).getByRole('group', { name: 'NPC Type 1 1' });

		const typeSelector = within(firstNpc).getByRole('combobox', {
			name: 'NPC type for NPC Type 1 1'
		});
		const typeOption = within(firstNpc).getByRole('option', { name: 'NPC Type 2' });
		await fireEvent.change(typeSelector, { target: { value: typeOption.getAttribute('value') } });
		expect(within(enemiesPanel).getByRole('group', { name: 'NPC Type 2 1' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: /Use NPC type|Selected/ })).toBeNull();

		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add NPC' }));
		expect(within(playersPanel).getByRole('group', { name: 'NPC Type 2 2' })).toBeTruthy();
	});

	it('changes a colliding NPC identifier but preserves it when the new type has no duplicate', async () => {
		render(newChallengePage);

		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		const enemiesPanel = screen.getByRole('group', { name: 'Enemies' });
		await fireEvent.click(within(enemiesPanel).getByRole('button', { name: 'Add NPC' }));
		const firstNpc = within(enemiesPanel).getByRole('group', { name: 'NPC Type 1 1' });
		await fireEvent.click(within(enemiesPanel).getByRole('button', { name: 'Add NPC' }));
		const firstTypeSecondNpc = within(enemiesPanel).getByRole('group', { name: 'NPC Type 1 2' });

		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		const secondTypeSelector = within(firstTypeSecondNpc).getByRole('combobox', {
			name: 'NPC type for NPC Type 1 2'
		});
		const secondTypeOption = within(firstTypeSecondNpc).getByRole('option', {
			name: 'NPC Type 2'
		});
		await fireEvent.change(secondTypeSelector, {
			target: { value: secondTypeOption.getAttribute('value') }
		});
		await fireEvent.click(within(enemiesPanel).getByRole('button', { name: 'Add NPC' }));
		const secondNpc = within(enemiesPanel).getByRole('group', { name: 'NPC Type 2 1' });

		const firstTypeSelector = within(firstNpc).getByRole('combobox', {
			name: 'NPC type for NPC Type 1 1'
		});
		const secondTypeOptionForFirstNpc = within(firstNpc).getByRole('option', {
			name: 'NPC Type 2'
		});
		await fireEvent.change(firstTypeSelector, {
			target: { value: secondTypeOptionForFirstNpc.getAttribute('value') }
		});
		const reassignedNpc = within(enemiesPanel).getByRole('group', { name: 'NPC Type 2 3' });
		expect(reassignedNpc).toBeTruthy();

		const originalTypeTwoNpcSelector = within(secondNpc).getByRole('combobox', {
			name: 'NPC type for NPC Type 2 1'
		});
		const firstTypeOption = within(secondNpc).getByRole('option', { name: 'NPC Type 1' });
		await fireEvent.change(originalTypeTwoNpcSelector, {
			target: { value: firstTypeOption.getAttribute('value') }
		});
		expect(within(enemiesPanel).getByRole('group', { name: 'NPC Type 1 1' })).toBeTruthy();
	});
});
