import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import setupChallengePage from './SetupPanel.svelte';
import {
	createUuid,
	loadChallengeLibrary,
	saveChallengeToLibrary,
	type StableId
} from '#lib/challenge';
import {
	createSetupChallenge,
	createSpawnEditChallenge,
	renderSetup,
	expectPageError,
	seedStoredChallengeLibrary,
	setRelativeTarget
} from '../../view-test-support';

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

describe('challenge setup view', () => {
	it('keeps challenge settings and NPC types in separate rows on wide screens', () => {
		const challengeSetupStyles = readFileSync(
			'src/routes/challenges/[challengeId]/setup/challenge-setup.css',
			'utf8'
		);
		expect(challengeSetupStyles).toMatch(
			/\.challenge-setup\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s
		);
		expect(challengeSetupStyles).not.toMatch(
			/@media\s*\(min-width:\s*960px\)\s*\{\s*\.challenge-setup\s*\{[^}]*grid-template-columns:\s*repeat\(2/s
		);
	});

	it('keeps NPC type fields spaced beneath their labels', () => {
		const challengeSetupStyles = readFileSync(
			'src/routes/challenges/[challengeId]/setup/challenge-setup.css',
			'utf8'
		);
		expect(challengeSetupStyles).toMatch(
			/\.challenge-setup\s+\.npc-type-card\s*\{[^}]*padding-block-start:\s*12px/s
		);
		expect(challengeSetupStyles).toMatch(
			/\.challenge-setup\s+\.npc-type-field-label\s*\{\s*min-height:\s*2lh/s
		);
	});

	it('spaces faction properties from the creature list', () => {
		const challengeSetupStyles = readFileSync(
			'src/routes/challenges/[challengeId]/setup/challenge-setup.css',
			'utf8'
		);
		expect(challengeSetupStyles).toMatch(
			/\.challenge-setup\s+\.faction-editor-content\s*\{[^}]*display:\s*grid;[^}]*gap:\s*12px/s
		);
	});

	it('removes the border around faction properties', () => {
		const challengeSetupStyles = readFileSync(
			'src/routes/challenges/[challengeId]/setup/challenge-setup.css',
			'utf8'
		);
		expect(challengeSetupStyles).toMatch(
			/\.challenge-setup\s+\.faction-editor-content\s*>\s*fieldset\s*\{[^}]*border:\s*0/s
		);
	});

	it('renders the setup editor in a full-width container', async () => {
		await renderSetup();
		const editor = screen.getByRole('group', { name: 'Challenge setup editing' });
		expect(editor.closest('[data-layout="full-width"]')).toBeTruthy();
	});

	it('spaces the setup editor from following controls', () => {
		const setupPanel = readFileSync(
			'src/routes/challenges/[challengeId]/SetupPanel.svelte',
			'utf8'
		);
		expect(setupPanel).toMatch(/\.setup-wide\s*\{[^}]*margin-block-end:\s*16px/s);
	});

	it('shows only unassociated validation errors below the setup fields', async () => {
		const challenge = {
			...createSetupChallenge(),
			name: ' ',
			runState: { initiativeResults: {}, spawnCount: -1 }
		};
		await saveChallengeToLibrary(challenge);
		await renderSetup();

		const summary = screen.getByRole('region', { name: 'Setup validation errors' });
		const nameInput = screen.getByRole('textbox', { name: 'Challenge name' });
		const editor = screen.getByRole('group', { name: 'Challenge setup editing' });
		const rollButton = screen.getByRole('button', { name: 'Roll Initiatives' });

		expect(nameInput.getAttribute('aria-invalid')).toBe('true');
		expect(within(summary).queryByText(/^\$\.name:/)).toBeNull();
		expect(summary.textContent).toContain('$.runState.spawnCount');
		expect(editor.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(
			summary.compareDocumentPosition(rollButton) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
	});

	it('shows complete saved-data diagnostics and only resets progress after confirmation', async () => {
		const challenge = {
			...createSetupChallenge(),
			name: 'Recovery',
			runState: { initiativeResults: {}, spawnCount: -1 }
		};
		await saveChallengeToLibrary(challenge);
		await renderSetup();
		expect(screen.getByRole('region', { name: 'Setup validation errors' }).textContent).toContain(
			'$.runState.spawnCount'
		);
		const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
		await fireEvent.click(screen.getByRole('button', { name: 'Reset saved progress' }));
		expect(screen.getByRole('region', { name: 'Setup validation errors' })).toBeTruthy();
		confirm.mockReturnValue(true);
		await fireEvent.click(screen.getByRole('button', { name: 'Reset saved progress' }));
		expect(screen.queryByRole('region', { name: 'Setup validation errors' })).toBeNull();
		await waitFor(async () =>
			expect((await loadChallengeLibrary()).challenges[0].runState).toBeUndefined()
		);
	});

	it('has a heading and a link back to the landing page', async () => {
		render(setupChallengePage);

		expect(await screen.findByRole('heading', { level: 1, name: 'Challenge setup' })).toBeTruthy();
		expect(document.title).toBe('Challenge setup | Soulstone Initiative Tracker');
	});

	describe('focus after adding entities', () => {
		it('focuses the first field of each added entity without stealing focus on load', async () => {
			await renderSetup();
			expect(document.body.contains(document.activeElement)).toBe(true);
			expect(document.activeElement?.tagName).toBe('BODY');

			await fireEvent.click(screen.getByRole('button', { name: 'Add Faction' }));
			await waitFor(() => {
				const active = document.activeElement as HTMLInputElement;
				expect(active.getAttribute('aria-label')).toMatch(/^Faction name: Faction/);
			});

			await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
			await waitFor(() => {
				const active = document.activeElement as HTMLInputElement;
				expect(active.getAttribute('aria-label')).toBe('NPC type name: NPC Type 1');
				expect(active.selectionStart).toBe(0);
				expect(active.selectionEnd).toBe('NPC Type 1'.length);
			});

			const playersPanel = screen.getByRole('group', { name: 'Players' });
			await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
			await waitFor(() => {
				const active = document.activeElement as HTMLInputElement;
				expect(active.getAttribute('aria-label')).toBe('Character name: Player 1');
			});

			const enemiesPanel = screen.getByRole('group', { name: 'Enemies' });
			await fireEvent.click(within(enemiesPanel).getByRole('button', { name: 'Add NPC' }));
			const npc = within(enemiesPanel).getByRole('group', { name: 'NPC Type 1 1' });
			await waitFor(() => {
				expect(document.activeElement).toBe(
					within(npc).getByRole('combobox', { name: /NPC type/ })
				);
			});

			await fireEvent.click(within(npc).getByRole('button', { name: 'Add turn for NPC Type 1 1' }));
			await waitFor(() => {
				const turn = within(npc).getByRole('group', { name: 'Turn 2' });
				expect(document.activeElement).toBe(
					within(turn).getByRole('combobox', { name: 'Turn initiative' })
				);
			});
		});

		it('does not move focus on unrelated rerenders', async () => {
			await renderSetup();
			await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
			const nameInput = screen.getByRole('textbox', { name: 'Challenge name' });
			nameInput.focus();

			await fireEvent.input(nameInput, { target: { value: 'Renamed' } });

			expect(document.activeElement).toBe(nameInput);
		});
	});
});

describe('challenge setup persistence', () => {
	it('loads the challenge from IndexedDB', async () => {
		await saveChallengeToLibrary({ ...createSetupChallenge(), name: 'Stored name' });

		await renderSetup();

		expect(
			(screen.getByRole('textbox', { name: 'Challenge name' }) as HTMLInputElement).value
		).toBe('Stored name');
	});

	it('saves edits to IndexedDB', async () => {
		await renderSetup();

		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'Edited' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.name).toBe('Edited');
			expect(saved?.npcTypes).toHaveLength(1);
		});
	});

	it('disables setup edits while the challenge is running', async () => {
		const challenge = createSetupChallenge();
		const turnId = '00000000-0000-4000-8000-000000000006' as StableId;
		challenge.name = 'Running challenge';
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
		challenge.runState = {
			initiativeResults: { [turnId]: 12 },
			generatedTurnOrder: [{ kind: 'turn', turnId }, { kind: 'spawn' }]
		};
		await saveChallengeToLibrary(challenge);

		await renderSetup();

		const nameInput = screen.getByRole('textbox', { name: 'Challenge name' }) as HTMLInputElement;
		expect(nameInput.matches(':disabled')).toBe(true);
		expect(
			(screen.getByRole('slider', { name: 'Fairness weight slider' }) as HTMLInputElement).matches(
				':disabled'
			)
		).toBe(true);
		expect(
			(screen.getByRole('button', { name: 'Add NPC Type' }) as HTMLButtonElement).matches(
				':disabled'
			)
		).toBe(true);
		await fireEvent.input(nameInput, { target: { value: 'Changed while running' } });

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.name).toBe('Running challenge');
			expect(saved?.runState?.generatedTurnOrder).toEqual([
				{ kind: 'turn', turnId },
				{ kind: 'spawn' }
			]);
		});
	});

	it('allows Spawn additions while keeping existing setup configuration locked', async () => {
		const challenge = createSpawnEditChallenge();
		await saveChallengeToLibrary(challenge);
		await renderSetup();

		const nameInput = screen.getByRole('textbox', { name: 'Challenge name' }) as HTMLInputElement;
		const players = screen.getByRole('group', { name: 'Players' });
		const aria = within(players).getByRole('group', { name: 'Aria' });
		const ariaNameInput = within(aria).getByRole('textbox', {
			name: 'Character name: Aria'
		}) as HTMLInputElement;
		const existingTurnInput = within(aria).getByRole('combobox', {
			name: 'Turn initiative'
		}) as HTMLSelectElement;
		expect(nameInput.matches(':disabled')).toBe(true);
		expect(
			(screen.getByRole('button', { name: 'Add Faction' }) as HTMLButtonElement).disabled
		).toBe(true);
		expect(
			(within(aria).getByRole('textbox', { name: 'Character name: Aria' }) as HTMLInputElement)
				.disabled
		).toBe(true);
		expect(
			(within(aria).getByRole('combobox', { name: 'Turn initiative' }) as HTMLSelectElement)
				.disabled
		).toBe(true);
		expect(
			(within(aria).getByRole('button', { name: 'Add turn for Aria' }) as HTMLButtonElement)
				.disabled
		).toBe(false);
		await fireEvent.input(ariaNameInput, { target: { value: 'Changed Aria' } });
		await fireEvent.change(existingTurnInput, { target: { value: 'roll-app' } });

		await fireEvent.click(within(aria).getByRole('button', { name: 'Add turn for Aria' }));
		const newTurn = within(aria).getByRole('group', { name: 'Turn 2' });
		const newTurnId = newTurn.getAttribute('data-entity-id');
		const initiativeChoice = within(newTurn).getByRole('combobox', {
			name: 'Turn initiative'
		}) as HTMLSelectElement;
		expect(initiativeChoice.disabled).toBe(false);
		await fireEvent.change(initiativeChoice, { target: { value: 'roll-app' } });
		expect(
			(
				screen.getByRole('spinbutton', {
					name: 'Initiative stat (d6) for Aria'
				}) as HTMLInputElement
			).disabled
		).toBe(true);

		await fireEvent.click(within(players).getByRole('button', { name: 'Add Player' }));
		const newCharacter = within(players).getByRole('group', { name: 'Player 1' });
		expect(
			(
				within(newCharacter).getByRole('textbox', {
					name: 'Character name: Player 1'
				}) as HTMLInputElement
			).disabled
		).toBe(false);

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0]!;
			const edit = saved.runState?.spawnEdit;
			const addedCharacter = saved.creatures.find(
				(creature) => creature.kind === 'character' && creature.name === 'Player 1'
			);
			expect(addedCharacter).toBeDefined();
			expect(
				saved.creatures.find((creature) => creature.id === challenge.creatures[0]!.id)
			).toMatchObject({
				name: 'Aria',
				turns: [
					{
						id: challenge.creatures[0]!.turns[0]!.id,
						initiative: { kind: 'roll', mode: 'manual' }
					},
					expect.objectContaining({ initiative: { kind: 'roll', mode: 'app' } })
				]
			});
			expect(edit?.newCreatureIds).toContain(addedCharacter?.id);
			expect(edit?.newTurnIds).toContain(addedCharacter?.turns[0]?.id);
			expect(edit?.newTurnIds).toContain(newTurnId);
		});
	});

	it('keeps existing fields locked when saved Spawn metadata has an invalid pending order', async () => {
		const challenge = createSpawnEditChallenge();
		delete challenge.runState!.generatedTurnOrder;
		await seedStoredChallengeLibrary({ formatVersion: 1, challenges: [challenge] });
		expect((await loadChallengeLibrary()).challenges[0]?.runState?.spawnEdit).toBeDefined();
		await renderSetup();

		expect(screen.getByRole('region', { name: 'Setup validation errors' })).toBeTruthy();
		expect(
			(screen.getByRole('textbox', { name: 'Challenge name' }) as HTMLInputElement).matches(
				':disabled'
			)
		).toBe(true);
		expect(
			(
				within(screen.getByRole('group', { name: 'Players' })).getByRole('textbox', {
					name: 'Character name: Aria'
				}) as HTMLInputElement
			).disabled
		).toBe(true);
	});

	it('prunes removed Spawn entities while preserving unaffected results, ties, and the Spawn order', async () => {
		const challenge = createSpawnEditChallenge();
		const ariaTurnId = challenge.creatures[0]!.turns[0]!.id;
		const bobTurnId = createUuid();
		const dependentTurnId = createUuid();
		const npcTypeId = createUuid();
		const npcId = createUuid();
		const npcTurnId = createUuid();
		challenge.npcTypes = [{ id: npcTypeId, name: 'Sentinel', initiativeStat: 2 }];
		challenge.creatures.push(
			{
				id: createUuid(),
				kind: 'character',
				name: 'Bob',
				factionId: challenge.factions[0]!.id,
				isHidden: false,
				turns: [
					{ id: bobTurnId, initiative: { kind: 'roll', mode: 'manual' } },
					{
						id: dependentTurnId,
						initiative: {
							kind: 'relative-position',
							relation: 'after',
							targetTurnId: npcTurnId
						}
					}
				]
			},
			{
				id: npcId,
				kind: 'npc',
				creatureTypeId: npcTypeId,
				identifier: '1',
				factionId: challenge.factions[1]!.id,
				isHidden: false,
				turns: [{ id: npcTurnId, initiative: { kind: 'roll', mode: 'app' } }]
			}
		);
		challenge.runState!.initiativeResults = {
			[ariaTurnId]: 12,
			[bobTurnId]: 12,
			[npcTurnId]: 8
		};
		challenge.runState!.tieDecisions = [[ariaTurnId, bobTurnId]];
		challenge.runState!.spawnEdit = {
			newCreatureIds: [npcId],
			newNpcTypeIds: [npcTypeId],
			newTurnIds: [npcTurnId],
			lockedInitiativeTurnIds: [ariaTurnId, bobTurnId]
		};
		await saveChallengeToLibrary(challenge);
		await renderSetup();

		const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
		await fireEvent.click(screen.getByRole('button', { name: 'Remove Sentinel 1' }));
		expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('1 dependent turn'));
		expect(screen.getByRole('group', { name: 'Sentinel 1' })).toBeTruthy();
		expect((await loadChallengeLibrary()).challenges[0]!.runState).toEqual(challenge.runState);

		confirmation.mockReturnValue(true);
		await fireEvent.click(screen.getByRole('button', { name: 'Remove Sentinel 1' }));
		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0]!;
			expect(saved.creatures.some((creature) => creature.id === npcId)).toBe(false);
			expect(saved.creatures[1]?.turns.some((turn) => turn.id === dependentTurnId)).toBe(false);
			expect(saved.runState?.initiativeResults).toEqual({ [ariaTurnId]: 12, [bobTurnId]: 12 });
			expect(saved.runState?.tieDecisions).toEqual([[ariaTurnId, bobTurnId]]);
			expect(saved.runState?.generatedTurnOrder).toEqual([{ kind: 'spawn' }]);
			expect(saved.runState?.spawnEdit?.newCreatureIds).toEqual([]);
			expect(saved.runState?.spawnEdit?.newTurnIds).toEqual([]);
			expect(saved.runState?.spawnEdit?.lockedInitiativeTurnIds).toEqual([ariaTurnId, bobTurnId]);
		});
	});

	it('clears only a changed new-turn result and its tie decision', async () => {
		const challenge = createSpawnEditChallenge();
		const baselineTurnId = challenge.creatures[0]!.turns[0]!.id;
		const newTurnId = createUuid();
		const otherTurnId = createUuid();
		challenge.creatures[0]!.turns.push({
			id: newTurnId,
			initiative: { kind: 'roll', mode: 'app' }
		});
		challenge.creatures.push({
			id: createUuid(),
			kind: 'character',
			name: 'Bob',
			factionId: challenge.factions[0]!.id,
			isHidden: false,
			turns: [{ id: otherTurnId, initiative: { kind: 'roll', mode: 'manual' } }]
		});
		challenge.runState!.initiativeResults = {
			[baselineTurnId]: 12,
			[newTurnId]: 8,
			[otherTurnId]: 8
		};
		challenge.runState!.tieDecisions = [[newTurnId, otherTurnId]];
		challenge.runState!.spawnEdit!.newTurnIds = [newTurnId];
		challenge.runState!.spawnEdit!.lockedInitiativeTurnIds = [baselineTurnId, otherTurnId];
		await saveChallengeToLibrary(challenge);
		await renderSetup();

		const aria = screen.getByRole('group', { name: 'Aria' });
		const newTurn = within(aria).getByRole('group', { name: 'Turn 2' });
		await fireEvent.change(within(newTurn).getByRole('combobox', { name: 'Turn initiative' }), {
			target: { value: 'roll-manual' }
		});

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0]!;
			expect(saved.runState?.initiativeResults).toEqual({
				[baselineTurnId]: 12,
				[otherTurnId]: 8
			});
			expect(saved.runState?.tieDecisions).toEqual([]);
			expect(saved.runState?.generatedTurnOrder).toEqual([{ kind: 'spawn' }]);
		});
	});

	it('autosaves finite invalid values and blocks rolling until corrected', async () => {
		await renderSetup();
		const fairnessInput = screen.getByRole('spinbutton', { name: 'Fairness weight value' });

		await fireEvent.input(fairnessInput, { target: { value: '-1' } });

		await waitFor(async () => {
			expect((await loadChallengeLibrary()).challenges[0]?.fairnessWeight).toBe(-1);
		});
		expect(
			(screen.getByRole('button', { name: 'Roll Initiatives' }) as HTMLButtonElement).disabled
		).toBe(true);
		expect(screen.getByText('Fairness weight must be a non-negative number.')).toBeTruthy();
	});

	it('shows validation messages on the inputs they belong to', async () => {
		await renderSetup();

		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: ' ' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		await fireEvent.input(screen.getByRole('textbox', { name: /^NPC type name/ }), {
			target: { value: '' }
		});

		const challengeName = screen.getByRole('textbox', { name: 'Challenge name' });
		expect(challengeName.getAttribute('aria-invalid')).toBe('true');
		expect(challengeName.getAttribute('aria-describedby')).toBeTruthy();
		expect(screen.getByText('Challenge name must not be blank.')).toBeTruthy();
		const npcTypeName = screen.getByRole('textbox', { name: /^NPC type name/ });
		expect(npcTypeName.getAttribute('aria-invalid')).toBe('true');
		expect(screen.getByText('NPC type name must not be blank.')).toBeTruthy();
		expect(screen.queryByRole('region', { name: 'Setup validation errors' })).toBeNull();
	});

	it('marks every input in duplicate-name groups as invalid', async () => {
		const challenge = createSetupChallenge();
		challenge.name = 'Duplicate names';
		challenge.factions[1]!.name = ' players ';
		challenge.npcTypes = [
			{
				id: '00000000-0000-4000-8000-000000000004' as StableId,
				name: 'Sentinel',
				initiativeStat: 1
			},
			{
				id: '00000000-0000-4000-8000-000000000005' as StableId,
				name: ' sentinel ',
				initiativeStat: 1
			}
		];
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'SENTINEL',
				factionId: challenge.factions[0]!.id,
				isHidden: false,
				turns: []
			},
			...['A', 'a'].map((identifier, index) => ({
				id: `00000000-0000-4000-8000-00000000001${index + 2}` as StableId,
				kind: 'npc' as const,
				creatureTypeId: '00000000-0000-4000-8000-000000000004' as StableId,
				identifier,
				factionId: challenge.factions[1]!.id,
				isHidden: false,
				turns: []
			}))
		];
		await saveChallengeToLibrary(challenge);
		await renderSetup();

		const factionNameInputs = screen
			.getAllByRole('textbox')
			.filter((input) => input.getAttribute('aria-label')?.startsWith('Faction name:'));
		const npcTypeNameInputs = screen
			.getAllByRole('textbox')
			.filter((input) => input.getAttribute('aria-label')?.startsWith('NPC type name:'));
		const characterNameInput = screen.getByRole('textbox', { name: 'Character name: SENTINEL' });
		const npcIdentifierInputs = screen.getAllByRole('textbox', { name: 'NPC identifier' });
		const duplicateInputs = [
			...factionNameInputs.map((input) => ({
				input,
				message: 'Faction names must be unique.'
			})),
			...npcTypeNameInputs.map((input) => ({
				input,
				message: 'PC and NPC type names must be unique'
			})),
			{
				input: characterNameInput,
				message: 'PC and NPC type names must be unique'
			},
			...npcIdentifierInputs.map((input) => ({
				input,
				message: 'NPC identifiers must be unique within each type.'
			}))
		];

		expect(factionNameInputs).toHaveLength(2);
		expect(npcTypeNameInputs).toHaveLength(2);
		expect(npcIdentifierInputs).toHaveLength(2);
		for (const { input, message } of duplicateInputs) {
			expect(input.getAttribute('aria-invalid')).toBe('true');
			const errorId = input.getAttribute('aria-describedby');
			expect(errorId).toBeTruthy();
			expect(document.getElementById(errorId ?? '')?.textContent).toContain(message);
		}
	});

	it('persists invalid finite placement values in editable drafts', async () => {
		const challenge = createSetupChallenge();
		challenge.name = 'Draft';
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: challenge.factions[0]!.id,
				isHidden: false,
				turns: [
					{
						id: '00000000-0000-4000-8000-000000000006' as StableId,
						initiative: { kind: 'roll', mode: 'manual' }
					}
				]
			}
		];
		await saveChallengeToLibrary(challenge);
		await renderSetup();

		await fireEvent.change(screen.getByRole('combobox', { name: 'Turn initiative' }), {
			target: { value: 'fixed-top' }
		});
		await fireEvent.input(screen.getByRole('spinbutton', { name: 'Position' }), {
			target: { value: '0.5' }
		});

		await waitFor(async () => {
			const turn = (await loadChallengeLibrary()).challenges[0]?.creatures[0]?.turns[0];
			expect(turn?.initiative).toEqual({ kind: 'fixed-position', from: 'top', position: 0.5 });
		});
		expect(
			(screen.getByRole('button', { name: 'Roll Initiatives' }) as HTMLButtonElement).disabled
		).toBe(true);
	});

	it('hides the character initiative stat unless a turn is app-rolled, keeping the value', async () => {
		const challenge = createSetupChallenge();
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				initiativeStat: 4,
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [
					{
						id: '00000000-0000-4000-8000-000000000006' as StableId,
						initiative: { kind: 'roll', mode: 'manual' }
					}
				]
			}
		];
		await saveChallengeToLibrary(challenge);

		const view = render(setupChallengePage);
		await screen.findByRole('heading', { level: 1, name: 'Challenge setup' });
		const statName = 'Initiative stat (d6) for Aria';
		expect(screen.queryByRole('spinbutton', { name: statName })).toBeNull();

		await fireEvent.change(screen.getByRole('combobox', { name: /Turn initiative/ }), {
			target: { value: 'roll-app' }
		});
		const input = await screen.findByRole('spinbutton', { name: statName });
		expect((input as HTMLInputElement).value).toBe('4');

		await fireEvent.change(screen.getByRole('combobox', { name: /Turn initiative/ }), {
			target: { value: 'roll-manual' }
		});
		await waitFor(() => expect(screen.queryByRole('spinbutton', { name: statName })).toBeNull());
		await waitFor(async () => {
			expect((await loadChallengeLibrary()).challenges[0]?.creatures[0]).toHaveProperty(
				'initiativeStat',
				4
			);
		});
		view.unmount();
	});

	it('autosaves, restores, and clears a character initiative stat', async () => {
		const challenge = createSetupChallenge();
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [
					{
						id: '00000000-0000-4000-8000-000000000006' as StableId,
						initiative: { kind: 'roll', mode: 'app' }
					}
				]
			}
		];
		await saveChallengeToLibrary(challenge);

		const firstView = render(setupChallengePage);
		await screen.findByRole('heading', { level: 1, name: 'Challenge setup' });
		const input = screen.getByRole('spinbutton', { name: 'Initiative stat (d6) for Aria' });
		expect((input as HTMLInputElement).value).toBe('');
		await fireEvent.input(input, { target: { value: '3' } });

		await waitFor(async () => {
			expect((await loadChallengeLibrary()).challenges[0]?.creatures[0]).toHaveProperty(
				'initiativeStat',
				3
			);
		});

		firstView.unmount();
		const secondView = render(setupChallengePage);
		await screen.findByRole('heading', { level: 1, name: 'Challenge setup' });
		const restoredInput = screen.getByRole('spinbutton', {
			name: 'Initiative stat (d6) for Aria'
		});
		expect((restoredInput as HTMLInputElement).value).toBe('3');
		await fireEvent.input(restoredInput, { target: { value: '' } });

		await waitFor(async () => {
			const savedCharacter = (await loadChallengeLibrary()).challenges[0]?.creatures[0];
			expect(savedCharacter).not.toHaveProperty('initiativeStat');
		});
		secondView.unmount();
	});

	it('shows all initiative-stat issues and blocks starting until they are fixed', async () => {
		const challenge = createSetupChallenge();
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [
					{
						id: '00000000-0000-4000-8000-000000000006' as StableId,
						initiative: { kind: 'roll', mode: 'app' }
					}
				]
			}
		];
		await saveChallengeToLibrary(challenge);

		render(setupChallengePage);
		const disabledStartButton = await screen.findByRole('button', { name: 'Roll Initiatives' });
		expect((disabledStartButton as HTMLButtonElement).disabled).toBe(true);
		expect(disabledStartButton.classList.contains('ui-button')).toBe(true);
		expect(await screen.findAllByText('Initiative is required.')).toHaveLength(1);
		await fireEvent.click(disabledStartButton);
		expect(mockedGoto).not.toHaveBeenCalled();

		await fireEvent.input(
			screen.getByRole('spinbutton', { name: 'Initiative stat (d6) for Aria' }),
			{
				target: { value: '2' }
			}
		);
		const startButton = await screen.findByRole('button', { name: 'Roll Initiatives' });
		expect(startButton.classList.contains('ui-button')).toBe(true);
		await fireEvent.click(startButton);
		expect(mockedGoto).not.toHaveBeenCalled();
	});

	it('saves the latest edits before starting the challenge', async () => {
		await renderSetup();

		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'Ready to roll' }
		});
		const startButton = screen.getByRole('button', { name: 'Roll Initiatives' });
		expect(startButton.closest('fieldset[disabled]')).toBeNull();
		await fireEvent.click(startButton);

		expect(mockedGoto).not.toHaveBeenCalled();
		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.name).toBe('Ready to roll');
		});
	});

	it('stays in setup and shows an error when starting cannot save', async () => {
		await renderSetup();
		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'Unsaved change' }
		});
		vi.stubGlobal('indexedDB', undefined);

		await fireEvent.click(screen.getByRole('button', { name: 'Roll Initiatives' }));

		await screen.findByRole('alert');
		expectPageError('Changes could not be saved.');
		expect(mockedGoto).not.toHaveBeenCalled();
	});

	it.each(['unknown', 'unreadable'] as const)(
		'shows a recovery link when the stored challenge is %s',
		async (kind) => {
			if (kind === 'unknown') {
				mockedPage.params = { challengeId: '00000000-0000-4000-8000-000000000099' };
			} else {
				vi.stubGlobal('indexedDB', undefined);
			}

			render(setupChallengePage);

			expect(
				await screen.findByRole('heading', { name: 'Challenge setup unavailable' })
			).toBeTruthy();
			expectPageError(
				kind === 'unknown'
					? 'No saved challenge matches this setup URL.'
					: 'The saved challenges could not be loaded.'
			);
			expect(screen.getByRole('link', { name: 'Return to challenges' }).getAttribute('href')).toBe(
				'/challenges'
			);
		}
	);
});

describe('new challenge setup', () => {
	it('allows fairness edits before start and preserves collected initiatives', async () => {
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
		challenge.runState = {
			initiativeResults: { [turnId]: 12 }
		};
		await saveChallengeToLibrary(challenge);

		await renderSetup();
		await fireEvent.input(screen.getByRole('slider', { name: 'Fairness weight slider' }), {
			target: { value: '4.25' }
		});

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.fairnessWeight).toBe(4.25);
			expect(saved?.runState?.initiativeResults[turnId]).toBe(12);
		});
	});

	it('clears a roll result when turn placement changes before start', async () => {
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
		challenge.runState = {
			initiativeResults: { [turnId]: 12 }
		};
		await saveChallengeToLibrary(challenge);

		await renderSetup();
		const turn = within(screen.getByRole('group', { name: 'Aria' })).getByRole('group', {
			name: 'Turn 1'
		});
		await fireEvent.change(within(turn).getByRole('combobox', { name: 'Turn initiative' }), {
			target: { value: 'static' }
		});

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.initiativeResults[turnId]).toBeUndefined();
			expect(saved?.runState?.generatedTurnOrder).toBeUndefined();
		});
	});

	it('preserves initiative results when the challenge name changes before start', async () => {
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
		challenge.runState = {
			initiativeResults: { [turnId]: 12 }
		};
		await saveChallengeToLibrary(challenge);

		await renderSetup();
		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'Ashen Company' }
		});

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.name).toBe('Ashen Company');
			expect(saved?.runState?.initiativeResults[turnId]).toBe(12);
		});
	});

	it('wraps named form groups in cards', async () => {
		await renderSetup();

		const expectCard = (hasCard: boolean) => expect(hasCard).toBe(true);

		const settings = screen.getByRole('group', { name: 'Challenge settings' });
		expectCard(settings.parentElement?.classList.contains('card') ?? false);
		expect(settings.querySelector(':scope > legend')?.classList.contains('visually-hidden')).toBe(
			true
		);
		expect(screen.getByRole('heading', { name: 'Challenge settings', level: 2 })).toBeTruthy();

		const npcTypes = screen.getByRole('group', { name: 'NPC types' });
		expectCard(npcTypes.parentElement?.classList.contains('card') ?? false);
		expect(npcTypes.querySelector(':scope > legend')?.classList.contains('visually-hidden')).toBe(
			true
		);
		expect(screen.getByRole('heading', { name: 'NPC types', level: 2 })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		const npcType = screen.getByRole('group', { name: 'NPC Type 1' });
		expectCard(npcType.parentElement?.classList.contains('card') ?? false);
		expect(screen.getByRole('heading', { name: 'NPC Type 1', level: 3 })).toBeTruthy();

		const factions = screen.getByRole('group', { name: 'Factions' });
		expectCard(factions.parentElement?.classList.contains('card') ?? false);
		expect(factions.querySelector(':scope > legend')?.classList.contains('visually-hidden')).toBe(
			true
		);
		expect(screen.getByRole('heading', { name: 'Factions', level: 2 })).toBeTruthy();
		const players = within(factions).getByRole('group', { name: 'Players' });
		expectCard(players.parentElement?.classList.contains('card') ?? false);
		expect(screen.getByRole('heading', { name: 'Players', level: 3 })).toBeTruthy();
		await fireEvent.click(within(players).getByRole('button', { name: 'Add Player' }));
		const player = within(players).getByRole('group', { name: 'Player 1' });
		expectCard(player.parentElement?.classList.contains('card') ?? false);
		expect(screen.getByRole('heading', { name: 'Player 1', level: 4 })).toBeTruthy();
		const turn = within(player).getByRole('group', { name: 'Turn 1' });
		expectCard(turn.parentElement?.classList.contains('card') ?? false);
		expect(screen.getByRole('heading', { name: 'Turn 1', level: 5 })).toBeTruthy();
	});

	it('shows challenge settings, the NPC type strip, and faction board', async () => {
		await renderSetup();

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
		expect(screen.queryByRole('combobox', { name: 'Faction' })).toBeNull();
	});
});

describe('challenge setup persistence', () => {
	it('loads the challenge from IndexedDB', async () => {
		await saveChallengeToLibrary({ ...createSetupChallenge(), name: 'Stored name' });

		await renderSetup();

		expect(
			(screen.getByRole('textbox', { name: 'Challenge name' }) as HTMLInputElement).value
		).toBe('Stored name');
	});

	it('saves edits to IndexedDB', async () => {
		await renderSetup();

		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'Edited' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.name).toBe('Edited');
			expect(saved?.npcTypes).toHaveLength(1);
		});
	});

	it('hides the character initiative stat unless a turn is app-rolled, keeping the value', async () => {
		const challenge = createSetupChallenge();
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				initiativeStat: 4,
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [
					{
						id: '00000000-0000-4000-8000-000000000006' as StableId,
						initiative: { kind: 'roll', mode: 'manual' }
					}
				]
			}
		];
		await saveChallengeToLibrary(challenge);

		const view = render(setupChallengePage);
		await screen.findByRole('heading', { level: 1, name: 'Challenge setup' });
		const statName = 'Initiative stat (d6) for Aria';
		expect(screen.queryByRole('spinbutton', { name: statName })).toBeNull();

		await fireEvent.change(screen.getByRole('combobox', { name: /Turn initiative/ }), {
			target: { value: 'roll-app' }
		});
		const input = await screen.findByRole('spinbutton', { name: statName });
		expect((input as HTMLInputElement).value).toBe('4');

		await fireEvent.change(screen.getByRole('combobox', { name: /Turn initiative/ }), {
			target: { value: 'roll-manual' }
		});
		await waitFor(() => expect(screen.queryByRole('spinbutton', { name: statName })).toBeNull());
		await waitFor(async () => {
			expect((await loadChallengeLibrary()).challenges[0]?.creatures[0]).toHaveProperty(
				'initiativeStat',
				4
			);
		});
		view.unmount();
	});

	it('autosaves, restores, and clears a character initiative stat', async () => {
		const challenge = createSetupChallenge();
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [
					{
						id: '00000000-0000-4000-8000-000000000006' as StableId,
						initiative: { kind: 'roll', mode: 'app' }
					}
				]
			}
		];
		await saveChallengeToLibrary(challenge);

		const firstView = render(setupChallengePage);
		await screen.findByRole('heading', { level: 1, name: 'Challenge setup' });
		const input = screen.getByRole('spinbutton', { name: 'Initiative stat (d6) for Aria' });
		expect((input as HTMLInputElement).value).toBe('');
		await fireEvent.input(input, { target: { value: '3' } });

		await waitFor(async () => {
			expect((await loadChallengeLibrary()).challenges[0]?.creatures[0]).toHaveProperty(
				'initiativeStat',
				3
			);
		});

		firstView.unmount();
		const secondView = render(setupChallengePage);
		await screen.findByRole('heading', { level: 1, name: 'Challenge setup' });
		const restoredInput = screen.getByRole('spinbutton', {
			name: 'Initiative stat (d6) for Aria'
		});
		expect((restoredInput as HTMLInputElement).value).toBe('3');
		await fireEvent.input(restoredInput, { target: { value: '' } });

		await waitFor(async () => {
			const savedCharacter = (await loadChallengeLibrary()).challenges[0]?.creatures[0];
			expect(savedCharacter).not.toHaveProperty('initiativeStat');
		});
		secondView.unmount();
	});

	it('shows all initiative-stat issues and blocks starting until they are fixed', async () => {
		const challenge = createSetupChallenge();
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: '00000000-0000-4000-8000-000000000002' as StableId,
				isHidden: false,
				turns: [
					{
						id: '00000000-0000-4000-8000-000000000006' as StableId,
						initiative: { kind: 'roll', mode: 'app' }
					}
				]
			}
		];
		await saveChallengeToLibrary(challenge);

		render(setupChallengePage);
		const disabledStartButton = await screen.findByRole('button', { name: 'Roll Initiatives' });
		expect((disabledStartButton as HTMLButtonElement).disabled).toBe(true);
		expect(disabledStartButton.classList.contains('ui-button')).toBe(true);
		expect(await screen.findAllByText('Initiative is required.')).toHaveLength(1);
		await fireEvent.click(disabledStartButton);
		expect(mockedGoto).not.toHaveBeenCalled();

		await fireEvent.input(
			screen.getByRole('spinbutton', { name: 'Initiative stat (d6) for Aria' }),
			{
				target: { value: '2' }
			}
		);
		const startButton = await screen.findByRole('button', { name: 'Roll Initiatives' });
		expect(startButton.classList.contains('ui-button')).toBe(true);
		await fireEvent.click(startButton);
		expect(mockedGoto).not.toHaveBeenCalled();
	});

	it('saves the latest edits before starting the challenge', async () => {
		await renderSetup();

		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'Ready to roll' }
		});
		const startButton = screen.getByRole('button', { name: 'Roll Initiatives' });
		expect(startButton.closest('fieldset[disabled]')).toBeNull();
		await fireEvent.click(startButton);

		expect(mockedGoto).not.toHaveBeenCalled();
		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.name).toBe('Ready to roll');
		});
	});

	it('stays in setup and shows an error when starting cannot save', async () => {
		await renderSetup();
		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'Unsaved change' }
		});
		vi.stubGlobal('indexedDB', undefined);

		await fireEvent.click(screen.getByRole('button', { name: 'Roll Initiatives' }));

		await screen.findByRole('alert');
		expectPageError('Changes could not be saved.');
		expect(mockedGoto).not.toHaveBeenCalled();
	});

	it.each(['unknown', 'unreadable'] as const)(
		'shows a recovery link when the stored challenge is %s',
		async (kind) => {
			if (kind === 'unknown') {
				mockedPage.params = { challengeId: '00000000-0000-4000-8000-000000000099' };
			} else {
				vi.stubGlobal('indexedDB', undefined);
			}

			render(setupChallengePage);

			expect(
				await screen.findByRole('heading', { name: 'Challenge setup unavailable' })
			).toBeTruthy();
			expectPageError(
				kind === 'unknown'
					? 'No saved challenge matches this setup URL.'
					: 'The saved challenges could not be loaded.'
			);
			expect(screen.getByRole('link', { name: 'Return to challenges' }).getAttribute('href')).toBe(
				'/challenges'
			);
		}
	);
});

describe('new challenge setup', () => {
	it('allows fairness edits before start and preserves collected initiatives', async () => {
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
		challenge.runState = {
			initiativeResults: { [turnId]: 12 }
		};
		await saveChallengeToLibrary(challenge);

		await renderSetup();
		await fireEvent.input(screen.getByRole('slider', { name: 'Fairness weight slider' }), {
			target: { value: '4.25' }
		});

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.fairnessWeight).toBe(4.25);
			expect(saved?.runState?.initiativeResults[turnId]).toBe(12);
		});
	});

	it('clears a roll result when turn placement changes before start', async () => {
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
		challenge.runState = {
			initiativeResults: { [turnId]: 12 }
		};
		await saveChallengeToLibrary(challenge);

		await renderSetup();
		const turn = within(screen.getByRole('group', { name: 'Aria' })).getByRole('group', {
			name: 'Turn 1'
		});
		await fireEvent.change(within(turn).getByRole('combobox', { name: 'Turn initiative' }), {
			target: { value: 'static' }
		});

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.runState?.initiativeResults[turnId]).toBeUndefined();
			expect(saved?.runState?.generatedTurnOrder).toBeUndefined();
		});
	});

	it('preserves initiative results when the challenge name changes before start', async () => {
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
		challenge.runState = {
			initiativeResults: { [turnId]: 12 }
		};
		await saveChallengeToLibrary(challenge);

		await renderSetup();
		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'Ashen Company' }
		});

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.name).toBe('Ashen Company');
			expect(saved?.runState?.initiativeResults[turnId]).toBe(12);
		});
	});

	it('uses shared card surfaces while preserving named form groups', async () => {
		await renderSetup();

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

	it('shows challenge settings, the NPC type strip, and faction board', async () => {
		await renderSetup();

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
		expect(screen.queryByRole('combobox', { name: 'Faction' })).toBeNull();
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

	it('adds factions and NPC types immediately with sensible defaults', async () => {
		await renderSetup();

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
		await renderSetup();

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
		await renderSetup();

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

	it('hides a creature with zero turns and keeps its visibility when turns are added', async () => {
		await renderSetup();

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

	it('confirms deleting a creature will also delete turns that reference it', async () => {
		await renderSetup();

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
		await renderSetup();

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
				.classList.contains('ui-button--danger')
		).toBe(true);

		const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false);
		const removeFactionButton = within(factionPanel).getByRole('button', {
			name: 'Remove faction Players'
		});
		expect(removeFactionButton.classList.contains('ui-button--danger')).toBe(true);
		expect(removeFactionButton.getAttribute('title')).toBe('Remove faction');
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
		await renderSetup();

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
		expect(removeNpcTypeButton.classList.contains('ui-button--danger')).toBe(true);
		expect(removeNpcTypeButton.getAttribute('title')).toBe('Remove NPC type');
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
		await renderSetup();

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
		await renderSetup();

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

describe('blank NPC identifiers', () => {
	it('accepts saved blank sole NPCs and flags them when they share a type', async () => {
		const challenge = createSetupChallenge();
		const typeId = '00000000-0000-4000-8000-000000000004' as StableId;
		const otherTypeId = '00000000-0000-4000-8000-000000000005' as StableId;
		challenge.npcTypes = [
			{ id: typeId, name: 'Ogre', initiativeStat: 2 },
			{ id: otherTypeId, name: 'Imp', initiativeStat: 2 }
		];
		challenge.creatures = [typeId, otherTypeId].map((creatureTypeId, index) => ({
			id: `00000000-0000-4000-8000-00000000001${index + 2}` as StableId,
			kind: 'npc' as const,
			creatureTypeId,
			identifier: index === 0 ? '  ' : '',
			factionId: challenge.factions[1]!.id,
			isHidden: false,
			turns: []
		}));
		await saveChallengeToLibrary(challenge);
		await renderSetup();

		const inputs = screen.getAllByRole('textbox', { name: /NPC identifier/ });
		expect(inputs).toHaveLength(2);
		for (const input of inputs) expect(input.getAttribute('aria-invalid')).not.toBe('true');

		const selector = screen.getByRole('combobox', { name: 'NPC type for Imp' });
		await fireEvent.change(selector, { target: { value: typeId } });

		for (const input of screen.getAllByRole('textbox', { name: /NPC identifier/ })) {
			expect(input.getAttribute('aria-invalid')).toBe('true');
			const errorId = input.getAttribute('aria-describedby') ?? '';
			expect(document.getElementById(errorId)?.textContent).toContain(
				'NPC identifier must not be blank.'
			);
		}
	});
});

describe('initiative stat changes', () => {
	const typeId = '00000000-0000-4000-8000-000000000021' as StableId;
	const otherTypeId = '00000000-0000-4000-8000-000000000022' as StableId;
	const factionId = '00000000-0000-4000-8000-000000000002' as StableId;
	const ids = [1, 2, 3, 4, 5].map((n) => `00000000-0000-4000-8000-0000000001${n}0` as StableId);
	const [heroApp, heroManual, heroStatic, npcApp, otherNpcApp] = ids;

	async function saveChallengeWithResults() {
		const challenge = createSetupChallenge();
		challenge.npcTypes = [
			{ id: typeId, name: 'Ghoul', initiativeStat: 2 },
			{ id: otherTypeId, name: 'Imp', initiativeStat: 2 }
		];
		const appTurn = (id: StableId) => ({ id, initiative: { kind: 'roll', mode: 'app' } as const });
		challenge.creatures = [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				initiativeStat: 2,
				factionId,
				isHidden: false,
				turns: [
					appTurn(heroApp!),
					{ id: heroManual!, initiative: { kind: 'roll', mode: 'manual' } },
					{ id: heroStatic!, initiative: { kind: 'static', value: 5 } }
				]
			},
			{
				id: '00000000-0000-4000-8000-000000000012' as StableId,
				kind: 'npc',
				creatureTypeId: typeId,
				identifier: '1',
				factionId,
				isHidden: false,
				turns: [appTurn(npcApp!)]
			},
			{
				id: '00000000-0000-4000-8000-000000000013' as StableId,
				kind: 'npc',
				creatureTypeId: otherTypeId,
				identifier: '1',
				factionId,
				isHidden: false,
				turns: [appTurn(otherNpcApp!)]
			}
		];
		challenge.runState = {
			initiativeResults: {
				[heroApp!]: 7,
				[heroManual!]: 9,
				[npcApp!]: 6,
				[otherNpcApp!]: 4
			},
			tieDecisions: [
				[heroApp!, heroManual!],
				[npcApp!, otherNpcApp!]
			]
		};
		await saveChallengeToLibrary(challenge);
		await renderSetup();
	}

	it('discards a character’s app-rolled results before start', async () => {
		await saveChallengeWithResults();
		await fireEvent.input(
			screen.getByRole('spinbutton', { name: 'Initiative stat (d6) for Aria' }),
			{
				target: { value: '3' }
			}
		);

		await waitFor(async () => {
			const runState = (await loadChallengeLibrary()).challenges[0]?.runState;
			expect(runState?.initiativeResults).toEqual({
				[heroManual!]: 9,
				[npcApp!]: 6,
				[otherNpcApp!]: 4
			});
			expect(runState?.generatedTurnOrder).toBeUndefined();
			expect(runState?.tieDecisions).toEqual([[npcApp!, otherNpcApp!]]);
		});
	});

	it('discards app-rolled results only for NPCs of the changed type before start', async () => {
		await saveChallengeWithResults();
		await fireEvent.input(screen.getByRole('spinbutton', { name: 'Initiative stat for Ghoul' }), {
			target: { value: '4' }
		});

		await waitFor(async () => {
			const runState = (await loadChallengeLibrary()).challenges[0]?.runState;
			expect(runState?.initiativeResults).toEqual({
				[heroApp!]: 7,
				[heroManual!]: 9,
				[otherNpcApp!]: 4
			});
			expect(runState?.generatedTurnOrder).toBeUndefined();
		});
	});

	it('keeps results when a stat input is set to its current value before start', async () => {
		await saveChallengeWithResults();
		await fireEvent.input(screen.getByRole('spinbutton', { name: 'Initiative stat for Ghoul' }), {
			target: { value: '2' }
		});
		await fireEvent.input(
			screen.getByRole('spinbutton', { name: 'Initiative stat (d6) for Aria' }),
			{
				target: { value: '2' }
			}
		);
		await fireEvent.input(screen.getByRole('textbox', { name: 'Challenge name' }), {
			target: { value: 'Renamed' }
		});

		await waitFor(async () => {
			const saved = (await loadChallengeLibrary()).challenges[0];
			expect(saved?.name).toBe('Renamed');
			expect(Object.keys(saved?.runState?.initiativeResults ?? {})).toHaveLength(4);
			expect(saved?.runState?.generatedTurnOrder).toBeUndefined();
		});
	});
});

describe('focus after adding entities', () => {
	it('focuses the first field of each added entity without stealing focus on load', async () => {
		await renderSetup();
		expect(document.body.contains(document.activeElement)).toBe(true);
		expect(document.activeElement?.tagName).toBe('BODY');

		await fireEvent.click(screen.getByRole('button', { name: 'Add Faction' }));
		await waitFor(() => {
			const active = document.activeElement as HTMLInputElement;
			expect(active.getAttribute('aria-label')).toMatch(/^Faction name: Faction/);
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		await waitFor(() => {
			const active = document.activeElement as HTMLInputElement;
			expect(active.getAttribute('aria-label')).toBe('NPC type name: NPC Type 1');
			expect(active.selectionStart).toBe(0);
			expect(active.selectionEnd).toBe('NPC Type 1'.length);
		});

		const playersPanel = screen.getByRole('group', { name: 'Players' });
		await fireEvent.click(within(playersPanel).getByRole('button', { name: 'Add Player' }));
		await waitFor(() => {
			const active = document.activeElement as HTMLInputElement;
			expect(active.getAttribute('aria-label')).toBe('Character name: Player 1');
		});

		const enemiesPanel = screen.getByRole('group', { name: 'Enemies' });
		await fireEvent.click(within(enemiesPanel).getByRole('button', { name: 'Add NPC' }));
		const npc = within(enemiesPanel).getByRole('group', { name: 'NPC Type 1 1' });
		await waitFor(() => {
			expect(document.activeElement).toBe(within(npc).getByRole('combobox', { name: /NPC type/ }));
		});

		await fireEvent.click(within(npc).getByRole('button', { name: 'Add turn for NPC Type 1 1' }));
		await waitFor(() => {
			const turn = within(npc).getByRole('group', { name: 'Turn 2' });
			expect(document.activeElement).toBe(
				within(turn).getByRole('combobox', { name: 'Turn initiative' })
			);
		});
	});

	it('does not move focus on unrelated rerenders', async () => {
		await renderSetup();
		await fireEvent.click(screen.getByRole('button', { name: 'Add NPC Type' }));
		const nameInput = screen.getByRole('textbox', { name: 'Challenge name' });
		nameInput.focus();

		await fireEvent.input(nameInput, { target: { value: 'Renamed' } });

		expect(document.activeElement).toBe(nameInput);
	});
});
