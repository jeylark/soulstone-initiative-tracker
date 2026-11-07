<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { DeepReadonly } from '#lib/DeepReadonly.js';
	import {
		createTurnOrderDisplay,
		createTurnDisplayLookup,
		loadChallengeLibrary,
		saveChallengeToLibrary,
		type Challenge,
		type StableId
	} from '#lib';
	import { FACTION_COLORS } from '#lib/challenge/faction-colors.js';
	import { prepareTurnOrder } from '#lib/challenge/turn-order.js';
	import ActionButton from '#lib/components/ActionButton.svelte';
	import Card from '#lib/components/Card.svelte';
	import ErrorDisplay from '#lib/components/ErrorDisplay.svelte';
	import ViewPage from '#lib/components/ViewPage.svelte';

	type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error';
	type GenerationIssue = {
		readonly status: 'missing-results' | 'placement-error';
		readonly turnIds: readonly StableId[];
	};

	let loadStatus = $state<LoadStatus>('loading');
	let hasSaveError = $state(false);
	let isSaving = $state(false);
	let challenge = $state<Challenge>();
	let generationIssue = $state<GenerationIssue>();
	let saveQueue: Promise<void> = Promise.resolve();
	let turnDisplayLookup = $derived.by(() =>
		challenge ? createTurnDisplayLookup(challenge) : new Map()
	);
	let generatedOrderDisplay = $derived.by(() => {
		const generatedTurnOrder = challenge?.runState?.generatedTurnOrder;
		return generatedTurnOrder
			? createTurnOrderDisplay(generatedTurnOrder, turnDisplayLookup)
			: undefined;
	});

	onMount(() => {
		void (async () => {
			try {
				const library = await loadChallengeLibrary();
				const loadedChallenge = library.challenges.find(
					(item) => item.id === page.params.challengeId
				);
				if (!loadedChallenge) {
					loadStatus = 'not-found';
					return;
				}
				challenge = loadedChallenge;
				loadStatus = 'ready';
			} catch {
				loadStatus = 'error';
			}
		})();
	});

	function enqueueSave(snapshotChallenge: DeepReadonly<Challenge>): Promise<void> {
		const toSave = { ...snapshotChallenge, updatedAt: new Date() };
		const pendingSave = saveQueue.then(() => saveChallengeToLibrary(toSave));
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

	async function generateTurnOrder(): Promise<void> {
		if (!challenge || isSaving) return;

		generationIssue = undefined;
		const runState = challenge.runState ?? { initiativeResults: {} };
		const preparation = prepareTurnOrder(challenge, runState.initiativeResults);
		if (preparation.status !== 'generated') {
			generationIssue = preparation;
			return;
		}

		const snapshotChallenge = $state.snapshot(challenge);
		const nextRunState = {
			...(snapshotChallenge.runState ?? { initiativeResults: {} }),
			generatedTurnOrder: [...preparation.order]
		};
		const challengeToSave = { ...snapshotChallenge, runState: nextRunState };
		isSaving = true;
		try {
			await enqueueSave(challengeToSave);
			challenge.runState = nextRunState;
			hasSaveError = false;
		} catch {
			hasSaveError = true;
		} finally {
			isSaving = false;
		}
	}

	async function updateCreatureVisibility(creatureId: StableId, isHidden: boolean): Promise<void> {
		if (!challenge) return;
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		if (!creature || creature.isHidden === isHidden) return;

		creature.isHidden = isHidden;
		try {
			await enqueueSave($state.snapshot(challenge));
		} catch {
			hasSaveError = true;
		}
	}
</script>

<ViewPage title="Turn order">
	{#if loadStatus === 'loading'}
		<p>Loading challenge…</p>
	{:else if loadStatus === 'ready' && challenge}
		<p>{challenge.name}</p>
		{#if generatedOrderDisplay}
			{#if generatedOrderDisplay.hasUnknownTurnIds}
				<p role="status">
					Some saved turns are no longer in this challenge. Recalculate the turn order to update it.
				</p>
			{/if}
		{/if}
		{#if generatedOrderDisplay}
			<ol aria-label="Generated turn order" class="turn-order-list">
				{#each generatedOrderDisplay.items as item (item.kind === 'turn' ? item.turnId : 'spawn')}
					{#if item.kind === 'spawn'}
						<li>
							<Card
								title="Spawn"
								headingLevel="h2"
								headerSize="small"
								spacing="compact"
								class="turn-order-card"
							>
								<div class="turn-order-card-details">
									<span class="turn-order-position">{item.position}</span>
								</div>
							</Card>
						</li>
					{:else}
						{@const factionColor = item.display.faction
							? FACTION_COLORS.find((color) => color.value === item.display.faction?.color)
							: undefined}
						<li>
							<div
								class="turn-order-card-tone"
								class:is-hidden={item.display.isHidden}
								style={factionColor ? `--faction-color: ${factionColor.hex}` : ''}
							>
								<Card
									title={item.display.label}
									headingLevel="h2"
									headerSize="small"
									spacing="compact"
									class="turn-order-card"
								>
									<div class="turn-order-card-details">
										<span class="turn-order-position">{item.position}</span>
										{#if item.display.faction}
											<span>{item.display.faction.name}</span>
										{/if}
									</div>
									<label class="turn-order-visibility">
										<input
											type="checkbox"
											checked={item.display.isHidden}
											onchange={(event) =>
												updateCreatureVisibility(
													item.display.creature.id,
													event.currentTarget.checked
												)}
										/>
										Hidden from viewers: {item.display.creatureName}
									</label>
									{#if item.display.isHidden}
										<p class="turn-order-hidden">Hidden</p>
									{/if}
								</Card>
							</div>
						</li>
					{/if}
				{/each}
			</ol>
		{/if}

		{#if generationIssue?.status === 'missing-results'}
			<ErrorDisplay
				message="Turn order cannot be generated until every rolling turn has a result."
			/>
			<ul aria-label="Turns missing initiative results">
				{#each generationIssue.turnIds as turnId (turnId)}
					<li>{turnDisplayLookup.get(turnId)?.label ?? 'Unknown turn'}</li>
				{/each}
			</ul>
		{:else if generationIssue?.status === 'placement-error'}
			<ErrorDisplay message="Turn placement could not be resolved." />
			<ul aria-label="Turns with invalid placement">
				{#each generationIssue.turnIds as turnId (turnId)}
					<li>{turnDisplayLookup.get(turnId)?.label ?? 'Unknown turn'}</li>
				{/each}
			</ul>
		{/if}

		<ActionButton disabled={isSaving} onclick={generateTurnOrder}>
			{challenge.runState?.generatedTurnOrder ? 'Recalculate' : 'Generate turn order'}
		</ActionButton>
		{#if hasSaveError}
			<ErrorDisplay message="Changes could not be saved." />
		{/if}
	{:else}
		{#if loadStatus === 'not-found'}
			<ErrorDisplay message="The challenge was not found." />
		{:else}
			<ErrorDisplay message="The challenge could not be loaded." />
		{/if}
		<a href={resolve('/')}>Return to home</a>
	{/if}
</ViewPage>

<style>
	.turn-order-list {
		display: grid;
		gap: 12px;
		margin-block: 24px;
		padding: 0;
		list-style: none;
	}

	.turn-order-list li,
	.turn-order-card-tone {
		min-width: 0;
	}

	.turn-order-visibility {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin-top: 12px;
	}

	.turn-order-card-tone :global(.turn-order-card) {
		background: color-mix(
			in srgb,
			var(--faction-color, var(--color-surface)) 12%,
			var(--color-surface)
		);
	}

	.turn-order-card-tone.is-hidden :global(.turn-order-card) {
		background: color-mix(in srgb, #808080 18%, var(--color-surface));
	}

	.turn-order-card-details {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.turn-order-position {
		font-variant-numeric: tabular-nums;
		font-weight: 700;
	}

	.turn-order-hidden {
		margin-block: 8px 0;
		font-weight: 600;
	}
</style>
