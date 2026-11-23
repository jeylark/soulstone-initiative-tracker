<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onMount, tick, type Snippet } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { DeepReadonly } from '#lib';
	import {
		createUuid,
		discardTieDecisionsForTurn,
		pruneTieDecisions,
		getNextFactionColor,
		loadChallengeLibrary,
		saveChallengeToLibrary,
		getChallengeSetupIssues,
		type Challenge,
		type ChallengeCreature,
		type Faction,
		type FactionColor,
		type InitiativeRollMode,
		type NpcType,
		type StableId,
		type Turn,
		type ValidationIssue
	} from '#lib/challenge';
	import { ActionButton, ErrorDisplay, ViewPage } from '#lib/components';
	import { ChallengeSettings, CreatureSetup, NpcTypeEditor } from './setup';
	import type { InitiativeChoice, TurnEditorChange } from './setup';
	import './setup/challenge-setup.css';

	type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error';
	const LOCKED_BLANK_NPC_IDENTIFIER_ERROR =
		'This NPC type has a locked NPC with a blank identifier. Choose another type or remove and recreate that NPC before adding another.';
	const INLINE_SETUP_ISSUE_PATHS = [
		/^\$\.(name|fairnessWeight)$/,
		/^\$\.factions\[\d+\]\.name$/,
		/^\$\.npcTypes\[\d+\]\.(name|initiativeStat)$/,
		/^\$\.creatures\[\d+\]\.(name|identifier|initiativeStat|factionId|creatureTypeId)$/,
		/^\$\.creatures\[\d+\]\.turns\[\d+\]\.initiative(?:\.(position|index|targetTurnId|value))?$/
	];

	function isInlineSetupIssue(issue: ValidationIssue): boolean {
		return INLINE_SETUP_ISSUE_PATHS.some((path) => path.test(issue.path));
	}

	interface Props {
		sharedChallenge?: Challenge;
		/** Optional action displayed beside the page title. */
		titleActions?: Snippet;
	}

	let { sharedChallenge, titleActions }: Props = $props();

	let loadStatus = $state<LoadStatus>('loading');
	let hasSaveError = $state(false);
	let localChallenge = $state<Challenge>({} as Challenge);
	let challenge = $derived(sharedChallenge ?? localChallenge);
	let newNpcTypeId = $state<StableId | ''>('');
	let npcCreationError = $state('');
	let saveQueue: Promise<void> = Promise.resolve();
	let saveTimeout: ReturnType<typeof setTimeout> | undefined;
	let isFirstRun = true;
	let setupIssues = $derived(loadStatus === 'ready' ? getChallengeSetupIssues(challenge) : []);
	let summaryIssues = $derived(setupIssues.filter((issue) => !isInlineSetupIssue(issue)));
	let isChallengeRunning = $derived(challenge.runState?.generatedTurnOrder !== undefined);
	let spawnEditState = $derived(challenge.runState?.spawnEdit);
	let isSpawnEditing = $derived(spawnEditState !== undefined);
	let canManageCreaturesAndTurns = $derived(!isChallengeRunning || isSpawnEditing);
	let canManageFactions = $derived(!isChallengeRunning && !isSpawnEditing);

	onMount(() => {
		if (sharedChallenge) {
			newNpcTypeId = challenge.npcTypes[0]?.id ?? '';
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
				newNpcTypeId = saved.npcTypes[0]?.id ?? '';
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
		if (isChallengeRunning) return;
		if (challenge.runState) delete challenge.runState.generatedTurnOrder;
	}

	function canConfigureCreature(creatureId: StableId): boolean {
		return (
			(!isChallengeRunning && !isSpawnEditing) ||
			(spawnEditState?.newCreatureIds.includes(creatureId) ?? false)
		);
	}

	function canConfigureNpcType(npcTypeId: StableId): boolean {
		return (
			(!isChallengeRunning && !isSpawnEditing) ||
			(spawnEditState?.newNpcTypeIds.includes(npcTypeId) ?? false)
		);
	}

	function canConfigureTurn(turnId: StableId): boolean {
		return (
			(!isChallengeRunning && !isSpawnEditing) ||
			(spawnEditState?.newTurnIds.includes(turnId) ?? false)
		);
	}

	async function focusNewEntity(entityId: StableId) {
		await tick();
		const entity = document.querySelector(`[data-entity-id="${entityId}"]`);
		const field = entity?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
			'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
		);
		if (!field) return;
		field.focus();
		if (field instanceof HTMLSelectElement) return;
		try {
			field.select();
		} catch {
			// Some input types do not support text selection.
		}
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

	function updateChallengeName(name: string) {
		if (!canManageFactions) return;
		challenge.name = name;
	}

	function resetSavedProgress(): void {
		if (
			window.confirm(
				'Reset saved initiative results, tie decisions, turn order and round progress?'
			)
		) {
			delete challenge.runState;
		}
	}

	function updateCreatureFaction(creatureId: StableId, factionId: StableId): void {
		if (!canManageFactions) return;
		if (!challenge.factions.some((faction) => faction.id === factionId)) return;
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		if (!creature) return;
		creature.factionId = factionId;
		if (challenge.runState) delete challenge.runState.tieDecisions;
		invalidateGeneratedTurnOrder();
	}

	function updateFairnessWeight(weight: number) {
		if (!canManageFactions) return;
		if (challenge.fairnessWeight === weight) return;
		challenge.fairnessWeight = weight;
		invalidateGeneratedTurnOrder();
	}

	function addFaction() {
		if (!canManageFactions) return;
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
		void focusNewEntity(faction.id);
	}

	function nextNumberedName(prefix: string, existingNames: readonly string[]): string {
		const names = new Set(existingNames);
		let index = 1;
		while (names.has(`${prefix} ${index}`)) index += 1;
		return `${prefix} ${index}`;
	}

	function renameFaction(factionId: StableId, name: string) {
		if (!canManageFactions) return;
		const faction = challenge.factions.find((item) => item.id === factionId);
		if (faction) faction.name = name;
	}

	function updateFactionColor(factionId: StableId, color: FactionColor) {
		if (!canManageFactions) return;
		const faction = challenge.factions.find((item) => item.id === factionId);
		if (faction) faction.color = color;
	}

	function removeFaction(factionId: StableId) {
		if (!canManageFactions) return;
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
		if (!canManageCreaturesAndTurns) return;
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
		if (spawnEditState) spawnEditState.newNpcTypeIds.push(npcType.id);
		newNpcTypeId ||= npcType.id;
		npcCreationError = '';
		void focusNewEntity(npcType.id);
	}

	function renameNpcType(npcTypeId: StableId, name: string) {
		if (!canConfigureNpcType(npcTypeId)) return;
		const npcType = challenge.npcTypes.find((item) => item.id === npcTypeId);
		if (npcType) npcType.name = name;
	}

	function updateNpcTypeInitiativeStat(npcTypeId: StableId, initiativeStat: number) {
		if (!canConfigureNpcType(npcTypeId)) return;
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
		if (!canManageCreaturesAndTurns) return;
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
		if (spawnEditState) {
			spawnEditState.newNpcTypeIds = spawnEditState.newNpcTypeIds.filter((id) => id !== npcTypeId);
		}
		if (newNpcTypeId === npcTypeId) newNpcTypeId = challenge.npcTypes[0]?.id ?? '';
		npcCreationError = '';
	}

	function createTurn(mode: InitiativeRollMode): Turn {
		return { id: createUuid(), initiative: { kind: 'roll', mode } };
	}

	function addTurn(creatureId: StableId) {
		if (!canManageCreaturesAndTurns) return;
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		if (!creature) return;
		const turn = createTurn(creature.kind === 'character' ? 'manual' : 'app');
		creature.turns.push(turn);
		if (spawnEditState) {
			spawnEditState.newTurnIds = [...spawnEditState.newTurnIds, turn.id];
		}
		void focusNewEntity(turn.id);
		invalidateGeneratedTurnOrder();
	}

	function addCharacter(factionId: StableId) {
		if (!canManageCreaturesAndTurns) return;
		const name = nextNumberedName(
			'Player',
			challenge.creatures.flatMap((creature) =>
				creature.kind === 'character' ? [creature.name] : []
			)
		);

		const id = createUuid();
		const firstTurn = createTurn('manual');
		challenge.creatures.push({
			id,
			kind: 'character',
			name,
			factionId,
			isHidden: false,
			turns: [firstTurn]
		});
		if (spawnEditState) spawnEditState.newCreatureIds.push(id);
		if (spawnEditState) {
			spawnEditState.newTurnIds = [...spawnEditState.newTurnIds, firstTurn.id];
		}
		void focusNewEntity(id);
		invalidateGeneratedTurnOrder();
	}

	function addNpc(factionId: StableId) {
		if (!canManageCreaturesAndTurns) return;
		if (!newNpcTypeId) return;

		const existingNpcs = challenge.creatures.flatMap((creature) =>
			creature.kind === 'npc' && creature.creatureTypeId === newNpcTypeId ? [creature] : []
		);
		const blankIdentifierNpcs = existingNpcs.filter((creature) => creature.identifier === '');
		const lockedBlankIdentifierNpcs = blankIdentifierNpcs.filter(
			(creature) => !(spawnEditState?.newCreatureIds.includes(creature.id) ?? false)
		);
		if (lockedBlankIdentifierNpcs.length > 0) {
			npcCreationError = LOCKED_BLANK_NPC_IDENTIFIER_ERROR;
			return;
		}
		npcCreationError = '';
		const existingIdentifiers = existingNpcs
			.filter((creature) => creature.identifier !== '')
			.map((creature) => creature.identifier);
		for (const creature of blankIdentifierNpcs) {
			const identifier = nextNumberedIdentifier(existingIdentifiers);
			creature.identifier = identifier;
			existingIdentifiers.push(identifier);
		}
		const identifier = nextNumberedIdentifier(existingIdentifiers);

		const id = createUuid();
		const firstTurn = createTurn('app');
		challenge.creatures.push({
			id,
			kind: 'npc',
			creatureTypeId: newNpcTypeId,
			identifier,
			factionId,
			isHidden: false,
			turns: [firstTurn]
		});
		if (spawnEditState) spawnEditState.newCreatureIds.push(id);
		if (spawnEditState) {
			spawnEditState.newTurnIds = [...spawnEditState.newTurnIds, firstTurn.id];
		}
		void focusNewEntity(id);
		invalidateGeneratedTurnOrder();
	}

	function updateNpcType(creatureId: StableId, npcTypeId: StableId): boolean {
		if (!canConfigureCreature(creatureId)) return false;
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		if (
			creature?.kind !== 'npc' ||
			!challenge.npcTypes.some((npcType) => npcType.id === npcTypeId)
		) {
			return false;
		}
		if (
			isSpawnEditing &&
			challenge.creatures.some(
				(item) =>
					item.kind === 'npc' &&
					item.id !== creatureId &&
					item.creatureTypeId === npcTypeId &&
					item.identifier === '' &&
					!(spawnEditState?.newCreatureIds.includes(item.id) ?? false)
			)
		) {
			npcCreationError = LOCKED_BLANK_NPC_IDENTIFIER_ERROR;
			return false;
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
		npcCreationError = '';
		discardAppRolledResults([creature]);
		return true;
	}

	function nextNumberedIdentifier(existingIdentifiers: readonly string[]): string {
		const identifiers = new Set(existingIdentifiers);
		let index = 1;
		while (identifiers.has(String(index))) index += 1;
		return String(index);
	}

	function updateCharacterName(creatureId: StableId, name: string) {
		if (!canConfigureCreature(creatureId)) return;
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		if (creature?.kind === 'character') creature.name = name;
	}

	function updateCharacterInitiativeStat(creatureId: StableId, initiativeStat: number | undefined) {
		if (!canConfigureCreature(creatureId)) return;
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
				targetTurnId: otherTurn.id
			};
		} else hasChanged = false;
		if (hasChanged) {
			if (
				previousInitiative.kind === 'roll' &&
				(turn.initiative.kind !== 'roll' || previousInitiative.mode !== turn.initiative.mode)
			) {
				if (challenge.runState) delete challenge.runState.initiativeResults[turnId];
				if (challenge.runState?.tieDecisions) {
					challenge.runState.tieDecisions = discardTieDecisionsForTurn(
						challenge.runState.tieDecisions,
						turnId
					);
				}
			}
			invalidateGeneratedTurnOrder();
		}
	}

	function updateTurnInitiative(
		creatureId: StableId,
		turnId: StableId,
		change: Readonly<TurnEditorChange>
	) {
		if (!canConfigureTurn(turnId)) return;
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
		} else if (change.kind === 'fixed-position' && initiative.kind === 'fixed-position') {
			hasChanged = initiative.position !== change.position;
			initiative.position = change.position;
		} else if (change.kind === 'relative-index' && initiative.kind === 'relative-position') {
			hasChanged = initiative.index !== change.index;
			if (change.index === undefined) delete initiative.index;
			else initiative.index = change.index;
		} else if (change.kind === 'relative-target' && initiative.kind === 'relative-position') {
			hasChanged = initiative.targetTurnId !== change.targetTurnId;
			initiative.targetTurnId = change.targetTurnId;
		}
		if (hasChanged) invalidateGeneratedTurnOrder();
	}

	function updateCreatureVisibility(creatureId: StableId, isHidden: boolean) {
		if (!canConfigureCreature(creatureId)) return;
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		if (creature) creature.isHidden = isHidden;
	}

	function updateNpcIdentifier(creatureId: StableId, identifier: string) {
		if (!canConfigureCreature(creatureId)) return;
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
		if (!canManageCreaturesAndTurns) return;
		challenge.creatures = challenge.creatures
			.filter((creature) => !creatureIds.has(creature.id))
			.map((creature) => ({
				...creature,
				turns: creature.turns.filter((turn) => !turnIds.has(turn.id))
			}));

		if (challenge.runState) {
			for (const turnId of turnIds) delete challenge.runState.initiativeResults[turnId];
			if (challenge.runState.spawnEdit) {
				const spawnEdit = challenge.runState.spawnEdit;
				spawnEdit.newCreatureIds = spawnEdit.newCreatureIds.filter((id) => !creatureIds.has(id));
				spawnEdit.newTurnIds = spawnEdit.newTurnIds.filter((id) => !turnIds.has(id));
				spawnEdit.lockedInitiativeTurnIds = spawnEdit.lockedInitiativeTurnIds.filter(
					(id) => !turnIds.has(id)
				);
			}
			if (challenge.runState.tieDecisions) {
				challenge.runState.tieDecisions = pruneTieDecisions(
					challenge,
					challenge.runState.initiativeResults,
					challenge.runState.tieDecisions
				);
			}
			invalidateGeneratedTurnOrder();
		}
	}

	function removeTurn(creatureId: StableId, turnId: StableId) {
		if (!canManageCreaturesAndTurns) return;
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		if (!creature?.turns.some((turn) => turn.id === turnId)) return;

		const turnIds = confirmTurnCascade(new Set([turnId]), 'Remove this turn?', false);
		if (turnIds === null) return;
		removeCreaturesAndTurns(new Set(), turnIds);
	}

	function removeCreature(creatureId: StableId) {
		if (!canManageCreaturesAndTurns) return;
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
	actions={titleActions}
>
	{#if loadStatus === 'loading'}
		<p>Loading challenge setup.</p>
	{:else if loadStatus === 'ready'}
		{#if hasSaveError}
			<ErrorDisplay message="Changes could not be saved." />
		{/if}
		<div class="setup-wide" data-layout="full-width">
			<fieldset aria-label="Challenge setup editing" class="setup-editing">
				<div class="challenge-setup">
					<ChallengeSettings
						name={challenge.name}
						fairnessWeight={challenge.fairnessWeight}
						isDisabled={!canManageFactions}
						{setupIssues}
						onNameChange={updateChallengeName}
						onFairnessWeightChange={updateFairnessWeight}
					/>

					<NpcTypeEditor
						npcTypes={challenge.npcTypes}
						{setupIssues}
						canManageNpcTypes={canManageCreaturesAndTurns}
						isNpcTypeConfigurable={canConfigureNpcType}
						creationError={npcCreationError}
						onCreate={addNpcType}
						onRename={renameNpcType}
						onInitiativeStatChange={updateNpcTypeInitiativeStat}
						onRemove={removeNpcType}
					/>

					<CreatureSetup
						factions={challenge.factions}
						creatures={challenge.creatures}
						npcTypes={challenge.npcTypes}
						{setupIssues}
						npcTypeId={newNpcTypeId}
						{canManageFactions}
						{canManageCreaturesAndTurns}
						isCreatureConfigurable={canConfigureCreature}
						isTurnConfigurable={canConfigureTurn}
						onCreateFaction={addFaction}
						onRenameFaction={renameFaction}
						onFactionColorChange={updateFactionColor}
						onRemoveFaction={removeFaction}
						onCreateCharacter={addCharacter}
						onCreateNpc={addNpc}
						onCreatureVisibilityChange={updateCreatureVisibility}
						onCreatureFactionChange={updateCreatureFaction}
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
			</fieldset>
		</div>
		{#if summaryIssues.length > 0}
			<section aria-label="Setup validation errors" class="setup-issue-summary">
				<h2>Validation errors</h2>
				<ul>
					{#each summaryIssues as issue (issue.path)}
						<li>{issue.path}: {issue.message}</li>
					{/each}
				</ul>
				<ActionButton
					variant="danger"
					disabled={!setupIssues.some((issue) => issue.path.startsWith('$.runState'))}
					onclick={resetSavedProgress}>Reset saved progress</ActionButton
				>
			</section>
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

<style>
	/* Breaks out of the shell's centered column to use the full viewport width. */
	.setup-wide {
		width: 100vw;
		margin-inline: calc(50% - 50vw);
		margin-block-end: 16px;
		padding-inline: 20px;
		box-sizing: border-box;
	}

	.setup-editing {
		min-width: 0;
		margin: 0;
		border: 0;
		padding: 0;
	}

	.setup-issue-summary {
		margin: 16px 0;
		overflow-wrap: anywhere;
	}
	.setup-issue-summary h2 {
		font-size: 18px;
	}
	.setup-issue-summary ul {
		padding-left: 24px;
	}
</style>
