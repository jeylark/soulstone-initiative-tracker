import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadChallengeLibrary, saveChallengeToLibrary } from '#lib/challenge';
import { createSetupChallenge, renderSetup, setRelativeTarget } from '../../../view-test-support';

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
	it('uses hard-coded initiative modes for new creatures and allows independent turn overrides', async () => {
		await renderSetup();

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

	it('adds and removes turn cards, renumbers them, and represents no initiative with zero turns', async () => {
		await renderSetup();

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
		await renderSetup();

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

	it('uses sibling indices for shared hook directions without redundant direction controls', async () => {
		await renderSetup();

		const playersPanel = screen.getByRole('group', { name: 'Players' });
		for (let index = 0; index < 3; index += 1) {
			await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		}
		const firstPlayer = within(playersPanel).getByRole('group', { name: 'Player 1' });
		const secondPlayer = within(playersPanel).getByRole('group', { name: 'Player 2' });
		const thirdPlayer = within(playersPanel).getByRole('group', { name: 'Player 3' });
		const firstTurn = within(firstPlayer).getByRole('group', { name: 'Turn 1' });
		const secondTurn = within(secondPlayer).getByRole('group', { name: 'Turn 1' });
		const thirdTurn = within(thirdPlayer).getByRole('group', { name: 'Turn 1' });

		const firstInitiative = within(firstTurn).getByRole('combobox', { name: 'Turn initiative' });
		await fireEvent.change(firstInitiative, { target: { value: 'fixed-top' } });
		expect(within(firstTurn).getByRole('spinbutton', { name: 'Position' })).toBeTruthy();
		expect(within(firstTurn).queryByRole('combobox', { name: 'Count from' })).toBeNull();
		await fireEvent.change(firstInitiative, { target: { value: 'fixed-bottom' } });

		await fireEvent.change(within(secondTurn).getByRole('combobox', { name: 'Turn initiative' }), {
			target: { value: 'relative-after' }
		});
		await fireEvent.change(within(thirdTurn).getByRole('combobox', { name: 'Turn initiative' }), {
			target: { value: 'relative-after' }
		});

		expect(within(secondTurn).getByRole('combobox', { name: 'Target turn' })).toBeTruthy();
		expect(within(secondTurn).queryByRole('combobox', { name: 'Relationship' })).toBeNull();
		expect(within(secondTurn).queryByRole('spinbutton', { name: 'Distance' })).toBeNull();
		const firstIndex = await within(secondTurn).findByRole('spinbutton', { name: 'Index' });
		const secondIndex = await within(thirdTurn).findByRole('spinbutton', { name: 'Index' });
		await fireEvent.input(firstIndex, { target: { value: '1' } });
		await fireEvent.input(secondIndex, { target: { value: '2' } });

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			const fixed = saved?.creatures.find(
				(creature) => creature.kind === 'character' && creature.name === 'Player 1'
			)?.turns[0]?.initiative;
			const firstHook = saved?.creatures.find(
				(creature) => creature.kind === 'character' && creature.name === 'Player 2'
			)?.turns[0]?.initiative;
			const secondHook = saved?.creatures.find(
				(creature) => creature.kind === 'character' && creature.name === 'Player 3'
			)?.turns[0]?.initiative;
			expect(fixed).toMatchObject({ kind: 'fixed-position', from: 'bottom' });
			expect(firstHook).toMatchObject({ kind: 'relative-position', relation: 'after', index: 1 });
			expect(secondHook).toMatchObject({ kind: 'relative-position', relation: 'after', index: 2 });
		});

		await fireEvent.change(within(thirdTurn).getByRole('combobox', { name: 'Turn initiative' }), {
			target: { value: 'relative-before' }
		});
		await waitFor(() => {
			expect(within(secondTurn).queryByRole('spinbutton', { name: 'Index' })).toBeNull();
			expect(within(thirdTurn).queryByRole('spinbutton', { name: 'Index' })).toBeNull();
		});
		expect(within(firstPlayer).getByRole('group', { name: 'Turn 1' })).toBeTruthy();
	});
});
