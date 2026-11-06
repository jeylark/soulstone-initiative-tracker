<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { DeepReadonly } from '#lib/DeepReadonly.js';
	import {
		loadChallengeLibrary,
		rollInitiative,
		saveChallengeToLibrary,
		type Challenge,
		type ChallengeCreature,
		type PlayerCharacter,
		type StableId,
		type TurnDisplay,
		createTurnDisplayLookup
	} from '#lib';
	import { FACTION_COLORS } from '#lib/challenge/faction-colors.js';
	import ActionButton from '#lib/components/ActionButton.svelte';
	import Card from '#lib/components/Card.svelte';
	import NumberInput from '#lib/components/forms/NumberInput.svelte';
	import ViewPage from '#lib/components/ViewPage.svelte';

	type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error';

	let loadStatus = $state<LoadStatus>('loading');
	let hasSaveError = $state(false);
	let challenge = $state<Challenge>();
	let reusableCharacters = $state<PlayerCharacter[]>([]);
	let initiativeInputs = $state<Partial<Record<StableId, string>>>({});
	let turnDisplayLookup: ReadonlyMap<StableId, TurnDisplay> = $derived.by(() =>
		challenge ? createTurnDisplayLookup(challenge, reusableCharacters) : new Map()
	);
	let saveQueue: Promise<void> = Promise.resolve();
	let saveTimeout: ReturnType<typeof setTimeout> | undefined;
	let isFirstRun = true;

	function parseInitiativeInput(value: string): number | undefined {
		if (value.trim() === '') return undefined;

		const initiative = Number(value);
		return Number.isInteger(initiative) && initiative >= 0 ? initiative : undefined;
	}

	function updateInitiative(turnId: StableId, value: string): void {
		initiativeInputs[turnId] = value;
		if (!challenge) return;

		const previousInitiative = challenge.runState?.initiativeResults[turnId];
		const initiativeResults = { ...(challenge.runState?.initiativeResults ?? {}) };
		const initiative = parseInitiativeInput(value);
		if (initiative === undefined) {
			delete initiativeResults[turnId];
		} else {
			initiativeResults[turnId] = initiative;
		}
		const runState = { ...(challenge.runState ?? {}), initiativeResults };
		if (previousInitiative !== initiative) delete runState.generatedTurnOrder;
		challenge.runState = runState;
	}

	function initiativeStat(creature: DeepReadonly<ChallengeCreature>): number | undefined {
		const stat =
			creature.kind === 'character'
				? reusableCharacters.find((character) => character.id === creature.characterId)
						?.initiativeStat
				: challenge?.npcTypes.find((npcType) => npcType.id === creature.creatureTypeId)
						?.initiativeStat;
		return typeof stat === 'number' && Number.isSafeInteger(stat) && stat > 0 ? stat : undefined;
	}

	function rollInitiativeForTurn(
		creature: DeepReadonly<ChallengeCreature>,
		turnId: StableId
	): void {
		if (!challenge) return;
		const turn = creature.turns.find((item) => item.id === turnId);
		if (!turn || turn.initiative.kind !== 'roll' || turn.initiative.mode !== 'app') {
			return;
		}

		const diceCount = initiativeStat(creature);
		if (diceCount === undefined) return;

		const previousInitiative = challenge.runState?.initiativeResults[turnId];
		const initiative = rollInitiative(diceCount);
		const initiativeResults = {
			...(challenge.runState?.initiativeResults ?? {}),
			[turnId]: initiative
		};
		const runState = {
			...(challenge.runState ?? {}),
			initiativeResults
		};
		if (previousInitiative !== initiative) {
			delete runState.generatedTurnOrder;
		}
		challenge.runState = runState;
	}

	function rollAll(): void {
		if (!challenge) return;

		const initiativeResults = { ...(challenge.runState?.initiativeResults ?? {}) };
		let hasResultChanged = false;
		for (const creature of challenge.creatures) {
			const diceCount = initiativeStat(creature);
			if (diceCount === undefined) continue;

			for (const turn of creature.turns) {
				if (
					turn.initiative.kind === 'roll' &&
					turn.initiative.mode === 'app' &&
					initiativeResults[turn.id] === undefined
				) {
					const initiative = rollInitiative(diceCount);
					if (initiativeResults[turn.id] !== initiative) hasResultChanged = true;
					initiativeResults[turn.id] = initiative;
				}
			}
		}

		const runState = { ...(challenge.runState ?? {}), initiativeResults };
		if (hasResultChanged) delete runState.generatedTurnOrder;
		challenge.runState = runState;
	}

	function hasRollableAppTurns(): boolean {
		const creatures = challenge?.creatures ?? [];
		return creatures.some(
			(creature) =>
				initiativeStat(creature) !== undefined &&
				creature.turns.some(
					(turn) =>
						turn.initiative.kind === 'roll' &&
						turn.initiative.mode === 'app' &&
						challenge?.runState?.initiativeResults[turn.id] === undefined
				)
		);
	}

	onMount(() => {
		void (async () => {
			try {
				const library = await loadChallengeLibrary();
				const loadedChallenge = library.challenges.find(
					(item) => item.id === page.params.challengeId
				);
				challenge = loadedChallenge;
				if (loadedChallenge) {
					reusableCharacters = library.characters;
					initiativeInputs = Object.fromEntries(
						loadedChallenge.creatures.flatMap((creature) =>
							creature.turns.flatMap((turn) => {
								if (turn.initiative.kind !== 'roll' || turn.initiative.mode !== 'manual') {
									return [];
								}
								const result = loadedChallenge.runState?.initiativeResults[turn.id];
								return [[turn.id, result === undefined ? '' : String(result)]];
							})
						)
					) as Partial<Record<StableId, string>>;
				}
				loadStatus = loadedChallenge ? 'ready' : 'not-found';
			} catch {
				loadStatus = 'error';
			}
		})();
	});

	$effect(() => {
		if (loadStatus !== 'ready' || !challenge) return;

		const snapshotChallenge = $state.snapshot(challenge);
		const snapshotCharacters = $state.snapshot(reusableCharacters);
		if (isFirstRun) {
			isFirstRun = false;
			return;
		}
		const timeout = setTimeout(() => {
			if (saveTimeout === timeout) saveTimeout = undefined;
			void enqueueSave(snapshotChallenge, snapshotCharacters).catch(() => undefined);
		}, 300);
		saveTimeout = timeout;
		return () => {
			clearTimeout(timeout);
			if (saveTimeout === timeout) saveTimeout = undefined;
		};
	});

	function enqueueSave(
		snapshotChallenge: DeepReadonly<Challenge>,
		snapshotCharacters: DeepReadonly<PlayerCharacter[]>
	): Promise<void> {
		const toSave = { ...snapshotChallenge, updatedAt: new Date() };
		const pendingSave = saveQueue.then(() => saveChallengeToLibrary(toSave, snapshotCharacters));
		saveQueue = pendingSave.then(
			() => {
				hasSaveError = false;
			},
			() => {
				hasSaveError = true;
			}
		);
		return pendingSave;
	}

	async function returnToSetup(event: Readonly<{ preventDefault: () => void }>): Promise<void> {
		event.preventDefault();
		if (!challenge) return;

		if (saveTimeout !== undefined) {
			clearTimeout(saveTimeout);
			saveTimeout = undefined;
		}

		try {
			await enqueueSave($state.snapshot(challenge), $state.snapshot(reusableCharacters));
			await goto(resolve('/challenges/[challengeId]/setup', { challengeId: challenge.id }));
		} catch {
			hasSaveError = true;
		}
	}

	async function continueToTurnOrder(
		event: Readonly<{ preventDefault: () => void }>
	): Promise<void> {
		event.preventDefault();
		if (!challenge) return;

		if (saveTimeout !== undefined) {
			clearTimeout(saveTimeout);
			saveTimeout = undefined;
		}

		try {
			await enqueueSave($state.snapshot(challenge), $state.snapshot(reusableCharacters));
			await goto(resolve('/challenges/[challengeId]/run', { challengeId: challenge.id }));
		} catch {
			hasSaveError = true;
		}
	}

	function rollingTurns(creature: DeepReadonly<ChallengeCreature>) {
		return creature.turns.flatMap((turn) => {
			if (turn.initiative.kind !== 'roll') return [];
			const display = turnDisplayLookup.get(turn.id);
			return display ? [{ turn, display, mode: turn.initiative.mode }] : [];
		});
	}
</script>

<ViewPage title="Initiative rolling">
	{#if loadStatus === 'loading'}
		<p>Loading challenge…</p>
	{:else if loadStatus === 'ready' && challenge}
		<p>{challenge.name}</p>
		<div class="faction-board">
			{#each challenge.factions as faction (faction.id)}
				{@const factionColor = FACTION_COLORS.find((color) => color.value === faction.color)}
				{@const factionCreatures = challenge.creatures.filter(
					(creature) =>
						creature.factionId === faction.id &&
						creature.turns.some((turn) => turn.initiative.kind === 'roll')
				)}
				{#if factionCreatures.length > 0}
					<section aria-label={faction.name} class="faction-section">
						<Card
							title={faction.name}
							headingLevel="h2"
							headerSize="medium"
							variant="inset"
							spacing="compact"
						>
							<div class="initiative-cards">
								{#each factionCreatures as creature (creature.id)}
									{@const turnsToRoll = rollingTurns(creature)}
									{#each turnsToRoll as { turn, display, mode } (turn.id)}
										{@const title = display.label}
										{@const label = `Initiative for ${title}`}
										{@const result = challenge.runState?.initiativeResults[turn.id]}
										<div
											class="initiative-card-tone"
											style={factionColor ? `--faction-color: ${factionColor.hex}` : ''}
										>
											<Card
												{title}
												headingLevel="h3"
												headerSize="small"
												spacing="compact"
												class="initiative-card"
											>
												<div class="initiative-field">
													{#if mode === 'manual'}
														{@const inputValue = initiativeInputs[turn.id] ?? ''}
														{@const hasWarning = result !== undefined && result > 18}
														{@const isInvalid =
															inputValue !== '' && parseInitiativeInput(inputValue) === undefined}
														<NumberInput
															{label}
															min={0}
															step={1}
															{hasWarning}
															warningMessage={hasWarning
																? `${label} is above 18. This result is still valid.`
																: undefined}
															{isInvalid}
															invalidMessage={isInvalid
																? 'Enter a non-negative whole number.'
																: undefined}
															value={inputValue}
															oninput={(event) =>
																updateInitiative(turn.id, event.currentTarget.value)}
														/>
													{:else}
														{@const turnLabel = title}
														{@const diceCount = initiativeStat(creature)}
														<div class="app-initiative-turn">
															{#if result !== undefined}
																<output>Initiative result: {result}</output>
																<ActionButton
																	aria-label={`Reroll initiative for ${turnLabel}`}
																	disabled={diceCount === undefined}
																	onclick={() => rollInitiativeForTurn(creature, turn.id)}
																>
																	Reroll
																</ActionButton>
															{:else}
																<ActionButton
																	aria-label={`Roll initiative for ${turnLabel}`}
																	disabled={diceCount === undefined}
																	onclick={() => rollInitiativeForTurn(creature, turn.id)}
																>
																	Roll
																</ActionButton>
															{/if}
															{#if diceCount === undefined}
																<p role="status">
																	{turnLabel} cannot be rolled because its initiative stat is missing
																	or invalid.
																</p>
															{/if}
														</div>
													{/if}
												</div>
											</Card>
										</div>
									{/each}
								{/each}
							</div>
						</Card>
					</section>
				{/if}
			{/each}
		</div>
		{#if hasRollableAppTurns()}
			<ActionButton onclick={rollAll}>Roll all</ActionButton>
		{/if}
		{#if hasSaveError}
			<p role="alert">Changes could not be saved.</p>
		{/if}
		<a
			href={resolve('/challenges/[challengeId]/setup', { challengeId: challenge.id })}
			onclick={returnToSetup}
		>
			Return to setup
		</a>
		<a
			href={resolve('/challenges/[challengeId]/run', { challengeId: challenge.id })}
			onclick={continueToTurnOrder}
		>
			Continue to turn order
		</a>
	{:else}
		<p>Challenge unavailable</p>
		{#if loadStatus === 'not-found'}
			<p>The challenge was not found.</p>
		{:else}
			<p>The challenge could not be loaded.</p>
		{/if}
		<a href={resolve('/')}>Return to home</a>
	{/if}
</ViewPage>

<style>
	.faction-board {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
		align-items: start;
		gap: 24px 16px;
		margin-block: 24px 16px;
	}

	.faction-section {
		min-width: 0;
	}

	.initiative-cards {
		display: flex;
		flex-wrap: wrap;
		align-items: start;
		gap: 12px;
	}

	.initiative-card-tone {
		flex: 0 1 max-content;
		min-width: 0;
		max-width: 100%;
	}

	.initiative-card-tone :global(.initiative-card) {
		width: auto;
		max-width: 100%;
		background: color-mix(
			in srgb,
			var(--faction-color, var(--color-surface)) 12%,
			var(--color-surface)
		);
	}

	.initiative-field {
		min-width: 0;
	}

	.app-initiative-turn {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 8px;
	}

	.app-initiative-turn p {
		grid-column: 1 / -1;
		margin: 0;
	}
</style>
