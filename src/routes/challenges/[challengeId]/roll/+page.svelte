<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { DeepReadonly } from '#lib/DeepReadonly.js';
	import {
		loadChallengeLibrary,
		type Challenge,
		type ChallengeCreature,
		type PlayerCharacter,
		type StableId
	} from '#lib';
	import { FACTION_COLORS } from '#lib/challenge/faction-colors.js';
	import Card from '#lib/components/Card.svelte';
	import NumberInput from '#lib/components/forms/NumberInput.svelte';
	import ViewPage from '#lib/components/ViewPage.svelte';

	type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error';

	let loadStatus = $state<LoadStatus>('loading');
	let challenge = $state<Challenge>();
	let reusableCharacters = $state<PlayerCharacter[]>([]);
	let initiativeInputs = $state<Partial<Record<StableId, string>>>({});

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
		: 'Running challenge'}
>
	{#if loadStatus === 'loading'}
		<p>Loading challenge…</p>
	{:else if loadStatus === 'ready' && challenge}
		<p>{challenge.name}</p>
		<div class="initiative-cards">
			{#each challenge.creatures as creature (creature.id)}
				{@const manualTurns = creature.turns.flatMap((turn, index) =>
					turn.initiative.kind === 'roll' && turn.initiative.mode === 'manual'
						? [{ turn, turnNumber: index + 1 }]
						: []
				)}
				{#if manualTurns.length > 0}
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
								{#each manualTurns as { turn, turnNumber } (turn.id)}
									<NumberInput
										label={creature.turns.length > 1
											? `Initiative for ${name} - Turn ${turnNumber}`
											: `Initiative for ${name}`}
										value={initiativeInputs[turn.id] ?? ''}
										oninput={(event) => (initiativeInputs[turn.id] = event.currentTarget.value)}
									/>
								{/each}
							</div>
						</Card>
					</div>
				{/if}
			{/each}
		</div>
		<a href={resolve('/challenges/[challengeId]/setup', { challengeId: challenge.id })}>
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
</style>
