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
		type StableId
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

		const initiativeResults = { ...(challenge.runState?.initiativeResults ?? {}) };
		const initiative = parseInitiativeInput(value);
		if (initiative === undefined) {
			delete initiativeResults[turnId];
		} else {
			initiativeResults[turnId] = initiative;
		}
		challenge.runState = { ...(challenge.runState ?? {}), initiativeResults };
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

		const initiativeResults = {
			...(challenge.runState?.initiativeResults ?? {}),
			[turnId]: rollInitiative(diceCount)
		};
		const runState = {
			...(challenge.runState ?? {}),
			initiativeResults
		};
		if (challenge.runState?.initiativeResults[turnId] !== undefined) {
			delete runState.generatedTurnOrder;
		}
		challenge.runState = runState;
	}

	function rollAll(): void {
		if (!challenge) return;

		const initiativeResults = { ...(challenge.runState?.initiativeResults ?? {}) };
		for (const creature of challenge.creatures) {
			const diceCount = initiativeStat(creature);
			if (diceCount === undefined) continue;

			for (const turn of creature.turns) {
				if (
					turn.initiative.kind === 'roll' &&
					turn.initiative.mode === 'app' &&
					initiativeResults[turn.id] === undefined
				) {
					initiativeResults[turn.id] = rollInitiative(diceCount);
				}
			}
		}

		challenge.runState = { ...(challenge.runState ?? {}), initiativeResults };
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

	function creatureName(creature: DeepReadonly<ChallengeCreature>): string {
		if (creature.kind === 'character') {
			return (
				reusableCharacters.find((character) => character.id === creature.characterId)?.name ??
				'Character'
			);
		}

		const typeName =
			challenge?.npcTypes.find((npcType) => npcType.id === creature.creatureTypeId)?.name ?? 'NPC';
		return `${typeName} ${creature.identifier}`.trim();
	}
</script>

<ViewPage
	title={loadStatus === 'not-found' || loadStatus === 'error'
		? 'Challenge unavailable'
		: 'Initiative Rolling'}
>
	{#if loadStatus === 'loading'}
		<p>Loading challenge…</p>
	{:else if loadStatus === 'ready' && challenge}
		<p>{challenge.name}</p>
		<div class="initiative-cards">
			{#each challenge.creatures as creature (creature.id)}
				{@const rollingTurns = creature.turns.flatMap((turn, index) =>
					turn.initiative.kind === 'roll'
						? [{ turn, turnNumber: index + 1, mode: turn.initiative.mode }]
						: []
				)}
				{#if rollingTurns.length > 0}
					{@const name = creatureName(creature)}
					{@const faction = challenge.factions.find((item) => item.id === creature.factionId)}
					{@const factionColor = FACTION_COLORS.find((color) => color.value === faction?.color)}
					<div
						class="initiative-card-tone"
						style={factionColor ? `--faction-color: ${factionColor.hex}` : ''}
					>
						<Card
							title={name}
							headingLevel="h2"
							headerSize="medium"
							spacing="compact"
							class="initiative-card"
						>
							<div class="initiative-fields">
								{#each rollingTurns as { turn, turnNumber, mode } (turn.id)}
									{@const label =
										creature.turns.length > 1
											? `Initiative for ${name} - Turn ${turnNumber}`
											: `Initiative for ${name}`}
									{@const result = challenge.runState?.initiativeResults[turn.id]}
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
												oninput={(event) => updateInitiative(turn.id, event.currentTarget.value)}
											/>
										{:else}
											{@const turnLabel = label.replace('Initiative for ', '')}
											{@const diceCount = initiativeStat(creature)}
											<div class="app-initiative-turn">
												<span>{turnLabel}</span>
												{#if result !== undefined}
													<output>Initiative result: {result}</output>
													<ActionButton
														aria-label={`Reroll initiative for ${turnLabel}`}
														disabled={diceCount === undefined}
														onclick={() => rollInitiativeForTurn(creature, turn.id)}
													>
														Reroll initiative
													</ActionButton>
												{:else}
													<ActionButton
														aria-label={`Roll initiative for ${turnLabel}`}
														disabled={diceCount === undefined}
														onclick={() => rollInitiativeForTurn(creature, turn.id)}
													>
														Roll initiative
													</ActionButton>
												{/if}
												{#if diceCount === undefined}
													<p role="status">
														{turnLabel} cannot be rolled because its initiative stat is missing or invalid.
													</p>
												{/if}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</Card>
					</div>
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
	{:else}
		{#if loadStatus === 'not-found'}
			<p>The challenge was not found.</p>
		{:else}
			<p>The challenge could not be loaded.</p>
		{/if}
		<a href={resolve('/')}>Return to home</a>
	{/if}
</ViewPage>

<style>
	.initiative-cards {
		display: grid;
		gap: 12px;
	}

	.initiative-card-tone :global(.initiative-card) {
		background: color-mix(
			in srgb,
			var(--faction-color, var(--color-surface)) 12%,
			var(--color-surface)
		);
	}

	.initiative-fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
		gap: 12px;
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
