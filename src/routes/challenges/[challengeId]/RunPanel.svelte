<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import type { DeepReadonly } from '#lib';
	import {
		advanceTurn,
		createTurnOrderDisplay,
		createTurnDisplayLookup,
		loadChallengeLibrary,
		prepareTurnOrder,
		pruneTieDecisions,
		type TurnOrderPreparation,
		saveChallengeToLibrary,
		type Challenge,
		type StableId
	} from '#lib/challenge';
	import { ActionButton, ErrorDisplay, ViewPage } from '#lib/components';
	import TurnList from './run/TurnList.svelte';

	type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error';

	interface Props {
		sharedChallenge?: Challenge;
		onSave?: () => Promise<void>;
	}

	let { sharedChallenge, onSave }: Props = $props();
	type GenerationIssue = Exclude<TurnOrderPreparation, { status: 'generated' }>;

	let loadStatus = $state<LoadStatus>('loading');
	let hasSaveError = $state(false);
	let isSaving = $state(false);
	let localChallenge = $state<Challenge>();
	let challenge = $derived(sharedChallenge ?? localChallenge);
	let generationIssue = $state<GenerationIssue>();
	let saveQueue: Promise<void> = Promise.resolve();
	let turnDisplayLookup = $derived.by(() =>
		challenge ? createTurnDisplayLookup(challenge) : new Map()
	);
	let clampedTurnIds = $derived.by(() => {
		if (!challenge?.runState?.generatedTurnOrder) return [];
		const preparation = prepareTurnOrder(challenge, challenge.runState.initiativeResults);
		return preparation.status === 'generated' ? preparation.clampedTurnIds : [];
	});
	let generatedOrderDisplay = $derived.by(() => {
		const generatedTurnOrder = challenge?.runState?.generatedTurnOrder;
		return generatedTurnOrder
			? createTurnOrderDisplay(generatedTurnOrder, turnDisplayLookup)
			: undefined;
	});

	onMount(() => {
		if (sharedChallenge) {
			loadStatus = 'ready';
			return;
		}
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
				localChallenge = loadedChallenge;
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
		const preparation = prepareTurnOrder(
			challenge,
			runState.initiativeResults,
			runState.tieDecisions
		);
		if (preparation.status !== 'generated') {
			generationIssue = preparation;
			return;
		}

		const snapshotChallenge = $state.snapshot(challenge);
		const nextRunState = {
			...(snapshotChallenge.runState ?? { initiativeResults: {} }),
			generatedTurnOrder: [...preparation.order]
		};
		if (runState.tieDecisions !== undefined) {
			nextRunState.tieDecisions = pruneTieDecisions(
				challenge,
				runState.initiativeResults,
				runState.tieDecisions
			);
		}
		const challengeToSave = { ...snapshotChallenge, runState: nextRunState };
		const previousRunState = challenge.runState;
		isSaving = true;
		try {
			challenge.runState = nextRunState;
			if (sharedChallenge && onSave) await onSave();
			else await enqueueSave(challengeToSave);
			hasSaveError = false;
		} catch {
			if (sharedChallenge) challenge.runState = previousRunState;
			hasSaveError = true;
		} finally {
			isSaving = false;
		}
	}

	async function advanceToNextTurn(): Promise<void> {
		if (!challenge?.runState?.generatedTurnOrder || isSaving) return;

		const previousRunState = challenge.runState;
		const nextRunState = advanceTurn($state.snapshot(previousRunState));
		const challengeToSave = { ...$state.snapshot(challenge), runState: nextRunState };
		isSaving = true;
		try {
			challenge.runState = nextRunState;
			if (sharedChallenge && onSave) await onSave();
			else await enqueueSave(challengeToSave);
			hasSaveError = false;
		} catch {
			challenge.runState = previousRunState;
			hasSaveError = true;
		} finally {
			isSaving = false;
		}
	}

	async function updateCreatureVisibility(creatureId: StableId, isHidden: boolean): Promise<void> {
		if (!challenge) return;
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		if (!creature || creature.isHidden === isHidden) return;

		const isCreatureHiddenBeforeUpdate = creature.isHidden;
		creature.isHidden = isHidden;
		try {
			if (sharedChallenge && onSave) await onSave();
			else await enqueueSave($state.snapshot(challenge));
		} catch {
			creature.isHidden = isCreatureHiddenBeforeUpdate;
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
			<p>Spawns: {challenge.runState?.spawnCount ?? 0}</p>
			<TurnList items={generatedOrderDisplay.items} onVisibilityChange={updateCreatureVisibility} />
		{/if}
		{#if clampedTurnIds.length > 0}
			<p role="status">Some placement values exceed the available order and were clamped.</p>
			<ul aria-label="Turns with clamped placement">
				{#each clampedTurnIds as turnId (turnId)}
					<li>{turnDisplayLookup.get(turnId)?.label ?? 'Unknown turn'}</li>
				{/each}
			</ul>
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
		{:else if generationIssue?.status === 'unresolved-ties'}
			<ErrorDisplay
				message="Turn order cannot be generated until tied turns in the same faction are ordered on the Roll tab."
			/>
			<ul aria-label="Unresolved initiative ties">
				{#each generationIssue.groups as group (group.join())}
					<li>
						{group
							.map((turnId) => turnDisplayLookup.get(turnId)?.label ?? 'Unknown turn')
							.join(', ')}
					</li>
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

		{#if generatedOrderDisplay}
			<ActionButton disabled={isSaving} onclick={advanceToNextTurn}>Next turn</ActionButton>
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
		<a href={resolve('/challenges')}>Return to challenges</a>
	{/if}
</ViewPage>
