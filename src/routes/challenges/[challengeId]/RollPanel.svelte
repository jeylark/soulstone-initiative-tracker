<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onDestroy, onMount } from 'svelte';
	import type { DeepReadonly } from '#lib';
	import {
		loadChallengeLibrary,
		rollInitiative,
		saveChallengeToLibrary,
		type Challenge,
		type ChallengeCreature,
		type StableId,
		type TurnDisplay,
		createTurnDisplayLookup,
		discardTieDecisionsForTurn,
		findInitiativeTies
	} from '#lib/challenge';
	import { ActionButton, ErrorDisplay, ViewPage } from '#lib/components';
	import InitiativeFactionSection from './roll/InitiativeFactionSection.svelte';
	import TieResolution from './roll/TieResolution.svelte';

	type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error';
	type WorkflowTab = 'setup' | 'roll' | 'run';

	interface Props {
		sharedChallenge?: Challenge;
		onTabChange?: (tab: WorkflowTab) => Promise<void> | void;
		/** Reports how many manual initiative inputs currently contain invalid values. */
		onValidationCountChange?: (count: number) => void;
	}

	let { sharedChallenge, onTabChange, onValidationCountChange }: Props = $props();

	let loadStatus = $state<LoadStatus>('loading');
	let hasSaveError = $state(false);
	let localChallenge = $state<Challenge>();
	let challenge = $derived(sharedChallenge ?? localChallenge);
	let initiativeInputs = $state<Partial<Record<StableId, string>>>({});
	let turnDisplayLookup: ReadonlyMap<StableId, TurnDisplay> = $derived.by(() =>
		challenge ? createTurnDisplayLookup(challenge) : new Map()
	);
	let tieGroups = $derived(
		challenge ? findInitiativeTies(challenge, challenge.runState?.initiativeResults ?? {}) : []
	);
	let isEditing = $derived(challenge?.runState?.spawnEdit !== undefined);
	// While editing, the generated order is only the pending Spawn step, so it must not lock Roll.
	let isChallengeRunning = $derived(
		challenge?.runState?.generatedTurnOrder !== undefined && !isEditing
	);
	let saveQueue: Promise<void> = Promise.resolve();
	let saveTimeout: ReturnType<typeof setTimeout> | undefined;
	let isFirstRun = true;

	function parseInitiativeInput(value: string): number | undefined {
		if (value.trim() === '') return undefined;

		const initiative = Number(value);
		return Number.isInteger(initiative) && initiative >= 0 ? initiative : undefined;
	}
	let invalidInputCount = $derived(
		Object.values(initiativeInputs).filter(
			(value) => value !== undefined && value !== '' && parseInitiativeInput(value) === undefined
		).length
	);

	$effect(() => onValidationCountChange?.(invalidInputCount));

	onDestroy(() => onValidationCountChange?.(0));

	/** Whether a turn's result may be changed; results collected before editing started never can. */
	function isTurnLocked(turnId: StableId): boolean {
		if (isChallengeRunning) return true;
		return challenge?.runState?.spawnEdit?.lockedInitiativeTurnIds.includes(turnId) ?? false;
	}

	/** Whether an app roll may happen; while editing, a result can only be collected once. */
	function canRollTurn(turnId: StableId): boolean {
		if (isTurnLocked(turnId)) return false;
		return !isEditing || challenge?.runState?.initiativeResults[turnId] === undefined;
	}

	function decideTie(order: readonly StableId[]): void {
		if (!challenge || isChallengeRunning) return;
		const decisions = (challenge.runState?.tieDecisions ?? []).filter(
			(decision) =>
				decision.length !== order.length || !decision.every((turnId) => order.includes(turnId))
		);
		const runState = {
			...(challenge.runState ?? { initiativeResults: {} }),
			tieDecisions: [...decisions, [...order]]
		};
		if (!isEditing) delete runState.generatedTurnOrder;
		challenge.runState = runState;
	}

	function updateInitiative(turnId: StableId, value: string): void {
		if (!challenge || isTurnLocked(turnId)) return;
		initiativeInputs[turnId] = value;

		const previousInitiative = challenge.runState?.initiativeResults[turnId];
		const initiativeResults = { ...(challenge.runState?.initiativeResults ?? {}) };
		const initiative = parseInitiativeInput(value);
		if (initiative === undefined) {
			delete initiativeResults[turnId];
		} else {
			initiativeResults[turnId] = initiative;
		}
		const runState = { ...(challenge.runState ?? {}), initiativeResults };
		if (previousInitiative !== initiative && !isEditing) delete runState.generatedTurnOrder;
		if (challenge.runState?.tieDecisions) {
			runState.tieDecisions = discardTieDecisionsForTurn(challenge.runState.tieDecisions, turnId);
		}
		challenge.runState = runState;
	}

	function initiativeStat(creature: DeepReadonly<ChallengeCreature>): number | undefined {
		const stat =
			creature.kind === 'character'
				? creature.initiativeStat
				: challenge?.npcTypes.find((npcType) => npcType.id === creature.creatureTypeId)
						?.initiativeStat;
		return typeof stat === 'number' && Number.isSafeInteger(stat) && stat >= 0 ? stat : undefined;
	}

	function rollInitiativeForTurn(
		creature: DeepReadonly<ChallengeCreature>,
		turnId: StableId
	): void {
		if (!challenge || !canRollTurn(turnId)) return;
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
		if (previousInitiative !== initiative && !isEditing) {
			delete runState.generatedTurnOrder;
		}
		if (challenge.runState?.tieDecisions) {
			runState.tieDecisions = discardTieDecisionsForTurn(challenge.runState.tieDecisions, turnId);
		}
		challenge.runState = runState;
	}

	function rollAll(): void {
		if (!challenge || isChallengeRunning) return;

		const initiativeResults = { ...(challenge.runState?.initiativeResults ?? {}) };
		let hasResultChanged = false;
		for (const creature of challenge.creatures) {
			const diceCount = initiativeStat(creature);
			if (diceCount === undefined) continue;

			for (const turn of creature.turns) {
				if (
					turn.initiative.kind === 'roll' &&
					turn.initiative.mode === 'app' &&
					initiativeResults[turn.id] === undefined &&
					canRollTurn(turn.id)
				) {
					const initiative = rollInitiative(diceCount);
					if (initiativeResults[turn.id] !== initiative) hasResultChanged = true;
					initiativeResults[turn.id] = initiative;
				}
			}
		}

		const runState = { ...(challenge.runState ?? {}), initiativeResults };
		if (hasResultChanged && !isEditing) delete runState.generatedTurnOrder;
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
		<fieldset disabled={isChallengeRunning} aria-label="Initiative editing" class="roll-editing">
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
						isInputLocked={isTurnLocked}
						isRollLocked={(turnId) => !canRollTurn(turnId)}
						onInput={updateInitiative}
						onRoll={rollInitiativeForTurn}
					/>
				{/each}
			</div>
			<TieResolution
				groups={tieGroups}
				decisions={challenge.runState?.tieDecisions ?? []}
				{turnDisplayLookup}
				onDecide={decideTie}
			/>
			<ActionButton disabled={!hasRollableAppTurns()} onclick={rollAll}>
				Roll all remaining
			</ActionButton>
		</fieldset>
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
	.roll-editing {
		min-width: 0;
		margin: 0;
		border: 0;
		padding: 0;
	}

	.faction-board {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
		align-items: start;
		gap: 24px 16px;
		margin-block: 24px 16px;
	}
</style>
