<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { DeepReadonly } from '#lib';
	import {
		createTurnOrderDisplay,
		createTurnDisplayLookup,
		loadChallengeLibrary,
		prepareTurnOrder,
		saveChallengeToLibrary,
		type Challenge,
		type StableId
	} from '#lib/challenge';
	import { ActionButton, ErrorDisplay, ViewPage } from '#lib/components';
	import TurnList from './TurnList.svelte';

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
			<TurnList items={generatedOrderDisplay.items} onVisibilityChange={updateCreatureVisibility} />
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
