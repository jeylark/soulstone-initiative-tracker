<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { DeepReadonly } from '#lib';
	import {
		createUuid,
		discardTieDecisionsForTurn,
		getNextFactionColor,
		loadChallengeLibrary,
		saveChallengeToLibrary,
		validateChallengeSetup,
		type Challenge,
		type ChallengeCreature,
		type Faction,
		type FactionColor,
		type InitiativeRollMode,
		type NpcType,
		type StableId,
		type Turn
	} from '#lib/challenge';
	import { ActionButton, ErrorDisplay, ViewPage } from '#lib/components';
	import ChallengeSettings from './setup/ChallengeSettings.svelte';
	import CreatureSetup from './setup/CreatureSetup.svelte';
	import NpcTypeEditor from './setup/NpcTypeEditor.svelte';
	import type { InitiativeChoice, TurnEditorChange } from './setup/challenge-setup-types';
	import './setup/challenge-setup.css';

	type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error';
	type WorkflowTab = 'setup' | 'roll' | 'run';

	interface Props {
		sharedChallenge?: Challenge;
		onTabChange?: (tab: WorkflowTab) => Promise<void> | void;
	}

	let { sharedChallenge, onTabChange }: Props = $props();

	let loadStatus = $state<LoadStatus>('loading');
	let hasSaveError = $state(false);
	let localChallenge = $state<Challenge>({} as Challenge);
	let challenge = $derived(sharedChallenge ?? localChallenge);
	let newNpcTypeId = $state<StableId | ''>('');
	let saveQueue: Promise<void> = Promise.resolve();
	let saveTimeout: ReturnType<typeof setTimeout> | undefined;
	let isFirstRun = true;
	let setupIssues = $derived(loadStatus === 'ready' ? validateChallengeSetup(challenge) : []);

	onMount(() => {
		if (sharedChallenge) {
			loadStatus = 'ready';
			return;
		}
		void (async () => {
			try {
				const library = await loadChallengeLibrary();
				const saved = library.challenges.find((item) => item.id === page.params.challengeId);
				if (!saved) {
					loadStatus = 'not-found';
					return;
				}
				localChallenge = saved;
				loadStatus = 'ready';
			} catch {
				loadStatus = 'error';
			}
		})();
	});

	$effect(() => {
		if (sharedChallenge || loadStatus !== 'ready') return;

		const snapshotChallenge = $state.snapshot(challenge);
		// The first run only reflects the just-loaded data.
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

	function invalidateGeneratedTurnOrder(): void {
		if (challenge.runState) delete challenge.runState.generatedTurnOrder;
	}

	function discardAppRolledResults(creatures: readonly DeepReadonly<ChallengeCreature>[]): void {
		const runState = challenge.runState;
		if (!runState) return;

		for (const creature of creatures) {
			for (const turn of creature.turns) {
				if (turn.initiative.kind !== 'roll' || turn.initiative.mode !== 'app') continue;
				delete runState.initiativeResults[turn.id];
				if (runState.tieDecisions) {
					runState.tieDecisions = discardTieDecisionsForTurn(runState.tieDecisions, turn.id);
				}
			}
		}
		invalidateGeneratedTurnOrder();
	}

	async function startChallenge(event?: Readonly<{ preventDefault: () => void }>) {
		event?.preventDefault();
		if (setupIssues.length > 0) return;
		if (sharedChallenge && onTabChange) {
			try {
				await onTabChange('roll');
			} catch {
				hasSaveError = true;
			}
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

	function updateChallengeName(name: string) {
		challenge.name = name;
	}

	function updateFairnessWeight(weight: number) {
		if (challenge.fairnessWeight === weight) return;
		challenge.fairnessWeight = weight;
		invalidateGeneratedTurnOrder();
	}

	function addFaction() {
		const name = nextNumberedName(
			'Faction',
			challenge.factions.map((faction) => faction.name)
		);
		const faction = {
			id: createUuid(),
			name,
			color: getNextFactionColor(challenge.factions)
		} satisfies Faction;
		challenge.factions.push(faction);
	}

	function nextNumberedName(prefix: string, existingNames: readonly string[]): string {
		const names = new Set(existingNames);
		let index = 1;
		while (names.has(`${prefix} ${index}`)) index += 1;
		return `${prefix} ${index}`;
	}

	function renameFaction(factionId: StableId, name: string) {
		const faction = challenge.factions.find((item) => item.id === factionId);
		if (faction) faction.name = name;
	}

	function updateFactionColor(factionId: StableId, color: FactionColor) {
		const faction = challenge.factions.find((item) => item.id === factionId);
		if (faction) faction.color = color;
	}

	function removeFaction(factionId: StableId) {
		const faction = challenge.factions.find((item) => item.id === factionId);
		if (!faction) return;

		const factionCreatures = challenge.creatures.filter(
			(creature) => creature.factionId === factionId
		);
		const creatureIds = new Set(factionCreatures.map((creature) => creature.id));
		const initialTurnIds = new Set(
			factionCreatures.flatMap((creature) => creature.turns.map(({ id }) => id))
		);
		const turnIds = confirmTurnCascade(
			initialTurnIds,
			`Remove faction "${faction.name}" and its ${factionCreatures.length} creature${factionCreatures.length === 1 ? '' : 's'}? Those creatures will also be deleted.`,
			factionCreatures.length > 0
		);
		if (turnIds === null) return;
		removeCreaturesAndTurns(creatureIds, turnIds);
		challenge.factions = challenge.factions.filter((faction) => faction.id !== factionId);
	}

	function addNpcType() {
		const name = nextNumberedName(
			'NPC Type',
			challenge.npcTypes.map((npcType) => npcType.name)
		);
		const npcType = {
			id: createUuid(),
			name,
			initiativeStat: 1
		} satisfies NpcType;
		challenge.npcTypes.push(npcType);
		newNpcTypeId ||= npcType.id;
	}

	function renameNpcType(npcTypeId: StableId, name: string) {
		const npcType = challenge.npcTypes.find((item) => item.id === npcTypeId);
		if (npcType) npcType.name = name;
	}

	function updateNpcTypeInitiativeStat(npcTypeId: StableId, initiativeStat: number) {
		const npcType = challenge.npcTypes.find((item) => item.id === npcTypeId);
		if (!npcType || npcType.initiativeStat === initiativeStat) return;

		npcType.initiativeStat = initiativeStat;
		discardAppRolledResults(
			challenge.creatures.filter(
				(creature) => creature.kind === 'npc' && creature.creatureTypeId === npcTypeId
			)
		);
	}

	function removeNpcType(npcTypeId: StableId) {
		const npcType = challenge.npcTypes.find((item) => item.id === npcTypeId);
		if (!npcType) return;

		const npcs = challenge.creatures.filter(
			(creature) => creature.kind === 'npc' && creature.creatureTypeId === npcTypeId
		);
		const creatureIds = new Set(npcs.map((creature) => creature.id));
		const initialTurnIds = new Set(npcs.flatMap((creature) => creature.turns.map(({ id }) => id)));
		const turnIds = confirmTurnCascade(
			initialTurnIds,
			`Remove NPC type "${npcType.name}" and its ${npcs.length} NPC${npcs.length === 1 ? '' : 's'}? Those NPCs will also be deleted.`,
			npcs.length > 0
		);
		if (turnIds === null) return;
		removeCreaturesAndTurns(creatureIds, turnIds);
		challenge.npcTypes = challenge.npcTypes.filter((npcType) => npcType.id !== npcTypeId);
		if (newNpcTypeId === npcTypeId) newNpcTypeId = challenge.npcTypes[0]?.id ?? '';
	}

	function createTurn(mode: InitiativeRollMode): Turn {
		return { id: createUuid(), initiative: { kind: 'roll', mode } };
	}

	function addTurn(creatureId: StableId) {
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		if (!creature) return;
		creature.turns.push(createTurn(creature.kind === 'character' ? 'manual' : 'app'));
		invalidateGeneratedTurnOrder();
	}

	function addCharacter(factionId: StableId) {
		const name = nextNumberedName(
			'Player',
			challenge.creatures.flatMap((creature) =>
				creature.kind === 'character' ? [creature.name] : []
			)
		);

		challenge.creatures.push({
			id: createUuid(),
			kind: 'character',
			name,
			factionId,
			isHidden: false,
			turns: [createTurn('manual')]
		});
		invalidateGeneratedTurnOrder();
	}

	function addNpc(factionId: StableId) {
		if (!newNpcTypeId) return;

		const existingIdentifiers = challenge.creatures.flatMap((creature) =>
			creature.kind === 'npc' && creature.creatureTypeId === newNpcTypeId
				? [creature.identifier]
				: []
		);
		const identifier = nextNumberedIdentifier(existingIdentifiers);

		challenge.creatures.push({
			id: createUuid(),
			kind: 'npc',
			creatureTypeId: newNpcTypeId,
			identifier,
			factionId,
			isHidden: false,
			turns: [createTurn('app')]
		});
		invalidateGeneratedTurnOrder();
	}

	function updateNpcType(creatureId: StableId, npcTypeId: StableId) {
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		if (
			creature?.kind !== 'npc' ||
			!challenge.npcTypes.some((npcType) => npcType.id === npcTypeId)
		) {
			return;
		}

		const destinationIdentifiers = challenge.creatures.flatMap((item) =>
			item.kind === 'npc' && item.id !== creatureId && item.creatureTypeId === npcTypeId
				? [item.identifier]
				: []
		);
		if (destinationIdentifiers.includes(creature.identifier)) {
			creature.identifier = nextNumberedIdentifier(destinationIdentifiers);
		}
		creature.creatureTypeId = npcTypeId;
		newNpcTypeId = npcTypeId;
	}

	function nextNumberedIdentifier(existingIdentifiers: readonly string[]): string {
		const identifiers = new Set(existingIdentifiers);
		let index = 1;
		while (identifiers.has(String(index))) index += 1;
		return String(index);
	}

	function updateCharacterName(creatureId: StableId, name: string) {
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		if (creature?.kind === 'character') creature.name = name;
	}

	function updateCharacterInitiativeStat(creatureId: StableId, initiativeStat: number | undefined) {
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		if (creature?.kind !== 'character') return;

		if (creature.initiativeStat === initiativeStat) return;

		if (initiativeStat === undefined) delete creature.initiativeStat;
		else creature.initiativeStat = initiativeStat;
		discardAppRolledResults([creature]);
	}

	function setTurnInitiative(creatureId: StableId, turnId: StableId, choice: InitiativeChoice) {
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		const turn = creature?.turns.find((item) => item.id === turnId);
		if (!turn) return;

		const previousInitiative = turn.initiative;
		const otherTurn = challenge.creatures.find((item) => item.id !== creatureId)?.turns[0];
		let hasChanged = true;
		if (choice === 'roll-app') turn.initiative = { kind: 'roll', mode: 'app' };
		else if (choice === 'roll-manual') turn.initiative = { kind: 'roll', mode: 'manual' };
		else if (choice === 'static') turn.initiative = { kind: 'static', value: 0 };
		else if (choice === 'fixed-top' || choice === 'fixed-bottom') {
			turn.initiative = {
				kind: 'fixed-position',
				from: choice === 'fixed-top' ? 'top' : 'bottom',
				position: 1
			};
		} else if (otherTurn) {
			turn.initiative = {
				kind: 'relative-position',
				relation: choice === 'relative-before' ? 'before' : 'after',
				distance: 1,
				targetTurnId: otherTurn.id
			};
		} else hasChanged = false;
		if (hasChanged) {
			if (previousInitiative.kind === 'roll' && turn.initiative.kind !== 'roll') {
				if (challenge.runState) delete challenge.runState.initiativeResults[turnId];
			}
			invalidateGeneratedTurnOrder();
		}
	}

	function updateTurnInitiative(
		creatureId: StableId,
		turnId: StableId,
		change: Readonly<TurnEditorChange>
	) {
		if (change.kind === 'choice') {
			setTurnInitiative(creatureId, turnId, change.choice);
			return;
		}

		const turn = challenge.creatures
			.find((creature) => creature.id === creatureId)
			?.turns.find((item) => item.id === turnId);
		const initiative = turn?.initiative;
		if (!initiative) return;

		let hasChanged = false;
		if (change.kind === 'static-value' && initiative.kind === 'static') {
			hasChanged = initiative.value !== change.value;
			initiative.value = change.value;
		} else if (change.kind === 'fixed-from' && initiative.kind === 'fixed-position') {
			hasChanged = initiative.from !== change.from;
			initiative.from = change.from;
		} else if (change.kind === 'fixed-position' && initiative.kind === 'fixed-position') {
			hasChanged = initiative.position !== change.position;
			initiative.position = change.position;
		} else if (change.kind === 'relative-relation' && initiative.kind === 'relative-position') {
			hasChanged = initiative.relation !== change.relation;
			initiative.relation = change.relation;
		} else if (change.kind === 'relative-distance' && initiative.kind === 'relative-position') {
			hasChanged = initiative.distance !== change.distance;
			initiative.distance = change.distance;
		} else if (change.kind === 'relative-target' && initiative.kind === 'relative-position') {
			hasChanged = initiative.targetTurnId !== change.targetTurnId;
			initiative.targetTurnId = change.targetTurnId;
		}
		if (hasChanged) invalidateGeneratedTurnOrder();
	}

	function updateCreatureVisibility(creatureId: StableId, isHidden: boolean) {
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		if (creature) creature.isHidden = isHidden;
	}

	function updateNpcIdentifier(creatureId: StableId, identifier: string) {
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		if (creature?.kind === 'npc') creature.identifier = identifier;
	}

	function dependentTurnClosure(initialTurnIds: ReadonlySet<StableId>): SvelteSet<StableId> {
		const turnIds = new SvelteSet(initialTurnIds);
		let hasNewDependentTurn = true;

		while (hasNewDependentTurn) {
			hasNewDependentTurn = false;
			for (const creature of challenge.creatures) {
				for (const turn of creature.turns) {
					if (
						turn.initiative.kind === 'relative-position' &&
						turnIds.has(turn.initiative.targetTurnId) &&
						!turnIds.has(turn.id)
					) {
						turnIds.add(turn.id);
						hasNewDependentTurn = true;
					}
				}
			}
		}

		return turnIds;
	}

	function confirmTurnCascade(
		initialTurnIds: ReadonlySet<StableId>,
		message: string,
		isConfirmationRequired: boolean
	): SvelteSet<StableId> | null {
		const turnIds = dependentTurnClosure(initialTurnIds);
		const dependentTurnCount = turnIds.size - initialTurnIds.size;
		if (dependentTurnCount === 0 && !isConfirmationRequired) return turnIds;

		const dependentTurnMessage =
			dependentTurnCount === 0
				? ''
				: ` All ${dependentTurnCount} dependent turn${dependentTurnCount === 1 ? '' : 's'} that directly or indirectly reference the removed turns will also be deleted.`;
		return window.confirm(`${message}${dependentTurnMessage}`) ? turnIds : null;
	}

	function removeCreaturesAndTurns(
		creatureIds: ReadonlySet<StableId>,
		turnIds: ReadonlySet<StableId>
	) {
		challenge.creatures = challenge.creatures
			.filter((creature) => !creatureIds.has(creature.id))
			.map((creature) => ({
				...creature,
				turns: creature.turns.filter((turn) => !turnIds.has(turn.id))
			}));

		if (challenge.runState) {
			for (const turnId of turnIds) delete challenge.runState.initiativeResults[turnId];
			invalidateGeneratedTurnOrder();
		}
	}

	function removeTurn(creatureId: StableId, turnId: StableId) {
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		if (!creature?.turns.some((turn) => turn.id === turnId)) return;

		const turnIds = confirmTurnCascade(new Set([turnId]), 'Remove this turn?', false);
		if (turnIds === null) return;
		removeCreaturesAndTurns(new Set(), turnIds);
	}

	function removeCreature(creatureId: StableId) {
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		if (!creature) return;

		const creatureIds = new Set([creatureId]);
		const initialTurnIds = new Set(creature.turns.map(({ id }) => id));
		const turnIds = confirmTurnCascade(initialTurnIds, 'Remove this creature?', false);
		if (turnIds === null) return;
		removeCreaturesAndTurns(creatureIds, turnIds);
	}
</script>

<ViewPage
	title={loadStatus === 'ready'
		? 'Challenge setup'
		: loadStatus === 'loading'
			? 'Loading challenge setup'
			: 'Challenge setup unavailable'}
>
	{#if loadStatus === 'loading'}
		<p>Loading challenge setup.</p>
	{:else if loadStatus === 'ready'}
		{#if hasSaveError}
			<ErrorDisplay message="Changes could not be saved." />
		{/if}
		<div class="challenge-setup">
			<ChallengeSettings
				name={challenge.name}
				fairnessWeight={challenge.fairnessWeight}
				onNameChange={updateChallengeName}
				onFairnessWeightChange={updateFairnessWeight}
			/>

			<NpcTypeEditor
				npcTypes={challenge.npcTypes}
				onCreate={addNpcType}
				onRename={renameNpcType}
				onInitiativeStatChange={updateNpcTypeInitiativeStat}
				onRemove={removeNpcType}
			/>
			{#if setupIssues.length > 0}
				<ul class="setup-validation-issues" role="alert">
					{#each setupIssues as issue (issue.path)}
						<li>{issue.message}</li>
					{/each}
				</ul>
			{/if}

			<CreatureSetup
				factions={challenge.factions}
				creatures={challenge.creatures}
				npcTypes={challenge.npcTypes}
				{setupIssues}
				npcTypeId={newNpcTypeId}
				onCreateFaction={addFaction}
				onRenameFaction={renameFaction}
				onFactionColorChange={updateFactionColor}
				onRemoveFaction={removeFaction}
				onCreateCharacter={addCharacter}
				onCreateNpc={addNpc}
				onCreatureVisibilityChange={updateCreatureVisibility}
				onNpcTypeChange={updateNpcType}
				onCharacterNameChange={updateCharacterName}
				onCharacterInitiativeStatChange={updateCharacterInitiativeStat}
				onNpcIdentifierChange={updateNpcIdentifier}
				onTurnChange={updateTurnInitiative}
				onAddTurn={addTurn}
				onRemoveTurn={removeTurn}
				onRemoveCreature={removeCreature}
			/>
		</div>
		{#if setupIssues.length > 0}
			<ActionButton disabled>Roll Initiatives</ActionButton>
		{:else if sharedChallenge}
			<ActionButton onclick={() => void startChallenge()}>Roll Initiatives</ActionButton>
		{:else}
			<ActionButton onclick={startChallenge}>Roll Initiatives</ActionButton>
		{/if}
	{:else}
		{#if loadStatus === 'error'}
			<ErrorDisplay message="The saved challenges could not be loaded." />
		{:else}
			<ErrorDisplay message="No saved challenge matches this setup URL." />
		{/if}
		<a href={resolve('/challenges')}>Return to challenges</a>
	{/if}
</ViewPage>
