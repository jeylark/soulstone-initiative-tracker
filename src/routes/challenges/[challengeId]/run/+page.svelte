<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { DeepReadonly } from '#lib/DeepReadonly.js';
	import {
		createTurnDisplayLookup,
		loadChallengeLibrary,
		saveChallengeToLibrary,
		type Challenge,
		type PlayerCharacter,
		type StableId
	} from '#lib';
	import { prepareTurnOrder } from '#lib/challenge/turn-order.js';
	import ActionButton from '#lib/components/ActionButton.svelte';
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
	let reusableCharacters = $state<PlayerCharacter[]>([]);
	let generationIssue = $state<GenerationIssue>();
	let saveQueue: Promise<void> = Promise.resolve();
	let turnDisplayLookup = $derived.by(() =>
		challenge ? createTurnDisplayLookup(challenge, reusableCharacters) : new Map()
	);

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
				reusableCharacters = library.characters;
				loadStatus = 'ready';
			} catch {
				loadStatus = 'error';
			}
		})();
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
			await enqueueSave(challengeToSave, $state.snapshot(reusableCharacters));
			challenge.runState = nextRunState;
			hasSaveError = false;
		} catch {
			hasSaveError = true;
		} finally {
			isSaving = false;
		}
	}
</script>

<ViewPage title="Turn order">
	{#if loadStatus === 'loading'}
		<p>Loading challenge…</p>
	{:else if loadStatus === 'ready' && challenge}
		<p>{challenge.name}</p>
		{#if challenge.runState?.generatedTurnOrder}
			<ol aria-label="Generated turn order">
				{#each challenge.runState.generatedTurnOrder as turnId (turnId)}
					{@const display = turnDisplayLookup.get(turnId)}
					<li>{display?.label ?? 'Unknown turn'}</li>
				{/each}
			</ol>
		{/if}

		{#if generationIssue?.status === 'missing-results'}
			<p>Turn order cannot be generated until every rolling turn has a result.</p>
			<ul aria-label="Turns missing initiative results">
				{#each generationIssue.turnIds as turnId (turnId)}
					<li>{turnDisplayLookup.get(turnId)?.label ?? 'Unknown turn'}</li>
				{/each}
			</ul>
		{:else if generationIssue?.status === 'placement-error'}
			<p>Turn placement could not be resolved.</p>
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
			<p role="alert">Changes could not be saved.</p>
		{/if}
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
