<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import type { DeepReadonly } from '#lib';
	import {
		loadChallengeLibrary,
		rollInitiative,
		saveChallengeToLibrary,
		type Challenge,
		type ChallengeCreature,
		type ChallengeRunState,
		type StableId,
		type TurnDisplay,
		createTurnDisplayLookup,
		discardTieDecisionsForTurn
	} from '#lib/challenge';
	import { ActionButton, ErrorDisplay, ViewPage } from '#lib/components';
	import InitiativeFactionSection from './roll/InitiativeFactionSection.svelte';

	type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error';
	type WorkflowTab = 'setup' | 'roll' | 'run';

	interface Props {
		sharedChallenge?: Challenge;
		onTabChange?: (tab: WorkflowTab) => Promise<void> | void;
	}

	let { sharedChallenge, onTabChange }: Props = $props();

	let loadStatus = $state<LoadStatus>('loading');
	let hasSaveError = $state(false);
	let localChallenge = $state<Challenge>();
	let challenge = $derived(sharedChallenge ?? localChallenge);
	let initiativeInputs = $state<Partial<Record<StableId, string>>>({});
	let turnDisplayLookup: ReadonlyMap<StableId, TurnDisplay> = $derived.by(() =>
		challenge ? createTurnDisplayLookup(challenge) : new Map()
	);
	let saveQueue: Promise<void> = Promise.resolve();
	let saveTimeout: ReturnType<typeof setTimeout> | undefined;
	let isFirstRun = true;

	function parseInitiativeInput(value: string): number | undefined {
		if (value.trim() === '') return undefined;

		const initiative = Number(value);
		return Number.isInteger(initiative) && initiative >= 0 ? initiative : undefined;
	}

	function discardTies(runState: ChallengeRunState, turnId: StableId): void {
		if (runState.tieDecisions === undefined) return;
		runState.tieDecisions = discardTieDecisionsForTurn(runState.tieDecisions, turnId);
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
		discardTies(runState, turnId);
		challenge.runState = runState;
	}

	function initiativeStat(creature: DeepReadonly<ChallengeCreature>): number | undefined {
		const stat =
			creature.kind === 'character'
				? creature.initiativeStat
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
		discardTies(runState, turnId);
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

	function restoreInitiativeInputs(loadedChallenge: DeepReadonly<Challenge>): void {
		initiativeInputs = Object.fromEntries(
			loadedChallenge.creatures.flatMap((creature) =>
				creature.turns.flatMap((turn) => {
					if (turn.initiative.kind !== 'roll' || turn.initiative.mode !== 'manual') return [];
					const result = loadedChallenge.runState?.initiativeResults[turn.id];
					return [[turn.id, result === undefined ? '' : String(result)]];
				})
			)
		) as Partial<Record<StableId, string>>;
	}

	onMount(() => {
		if (sharedChallenge) {
			loadStatus = 'ready';
			restoreInitiativeInputs(sharedChallenge);
			return;
		}
		void (async () => {
			try {
				const library = await loadChallengeLibrary();
				const loadedChallenge = library.challenges.find(
					(item) => item.id === page.params.challengeId
				);
				localChallenge = loadedChallenge;
				if (loadedChallenge) restoreInitiativeInputs(loadedChallenge);
				loadStatus = loadedChallenge ? 'ready' : 'not-found';
			} catch {
				loadStatus = 'error';
			}
		})();
	});

	$effect(() => {
		if (sharedChallenge || loadStatus !== 'ready' || !challenge) return;

		const snapshotChallenge = $state.snapshot(challenge);
		if (isFirstRun) {
			isFirstRun = false;
			return;
		}
		const timeout = setTimeout(() => {
			if (saveTimeout === timeout) saveTimeout = undefined;
			void enqueueSave(snapshotChallenge).catch(() => undefined);
		}, 300);
		saveTimeout = timeout;
		return () => {
			clearTimeout(timeout);
			if (saveTimeout === timeout) saveTimeout = undefined;
		};
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

	async function returnToSetup(event?: Readonly<{ preventDefault: () => void }>): Promise<void> {
		event?.preventDefault();
		if (!challenge) return;
		if (sharedChallenge && onTabChange) {
			await onTabChange('setup');
			return;
		}

		if (saveTimeout !== undefined) {
			clearTimeout(saveTimeout);
			saveTimeout = undefined;
		}

		try {
			await enqueueSave($state.snapshot(challenge));
		} catch {
			hasSaveError = true;
		}
	}

	async function continueToTurnOrder(
		event?: Readonly<{ preventDefault: () => void }>
	): Promise<void> {
		event?.preventDefault();
		if (!challenge) return;
		if (sharedChallenge && onTabChange) {
			await onTabChange('run');
			return;
		}

		if (saveTimeout !== undefined) {
			clearTimeout(saveTimeout);
			saveTimeout = undefined;
		}

		try {
			await enqueueSave($state.snapshot(challenge));
		} catch {
			hasSaveError = true;
		}
	}
</script>

<ViewPage title="Initiative rolling">
	{#if loadStatus === 'loading'}
		<p>Loading challenge…</p>
	{:else if loadStatus === 'ready' && challenge}
		<p>{challenge.name}</p>
		<div class="faction-board">
			{#each challenge.factions as faction (faction.id)}
				<InitiativeFactionSection
					{faction}
					creatures={challenge.creatures}
					{turnDisplayLookup}
					initiativeResults={challenge.runState?.initiativeResults ?? {}}
					{initiativeInputs}
					isInvalidInput={(value) => value !== '' && parseInitiativeInput(value) === undefined}
					canRoll={(creature) => initiativeStat(creature) !== undefined}
					onInput={updateInitiative}
					onRoll={rollInitiativeForTurn}
				/>
			{/each}
		</div>
		{#if hasRollableAppTurns()}
			<ActionButton onclick={rollAll}>Roll all</ActionButton>
		{/if}
		{#if hasSaveError}
			<ErrorDisplay message="Changes could not be saved." />
		{/if}
		<ActionButton variant="neutral" onclick={() => void returnToSetup()}
			>Return to setup</ActionButton
		>
		<ActionButton onclick={() => void continueToTurnOrder()}>Continue to turn order</ActionButton>
	{:else}
		{#if loadStatus === 'not-found'}
			<ErrorDisplay message="The challenge was not found." />
		{:else}
			<ErrorDisplay message="The challenge could not be loaded." />
		{/if}
		<a href={resolve('/challenges')}>Return to challenges</a>
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
</style>
