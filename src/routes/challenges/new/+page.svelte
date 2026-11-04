<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import {
		createUuid,
		type Challenge,
		type Faction,
		type FactionColor,
		type InitiativeRollMode,
		type NpcType,
		type PlayerCharacter,
		type StableId,
		type Turn
	} from '#lib';
	import { getNextFactionColor } from '../../../lib/challenge/faction-colors.js';
	import ChallengeSettings from '#lib/components/challenge-setup/ChallengeSettings.svelte';
	import CreatureSetup from '#lib/components/challenge-setup/CreatureSetup.svelte';
	import NpcTypeEditor from '#lib/components/challenge-setup/NpcTypeEditor.svelte';
	import ViewPage from '#lib/components/ViewPage.svelte';
	import type {
		InitiativeChoice,
		TurnEditorChange
	} from '../../../lib/components/challenge-setup/challenge-setup-types.js';
	import '../../../lib/components/challenge-setup/challenge-setup.css';

	const createdAt = new Date();
	const playersColor = getNextFactionColor([]);
	const enemiesColor = getNextFactionColor([{ color: playersColor }]);
	let challenge = $state<Challenge>({
		id: createUuid(),
		name: '',
		createdAt,
		updatedAt: createdAt,
		factions: [
			{ id: createUuid(), name: 'Players', color: playersColor },
			{ id: createUuid(), name: 'Enemies', color: enemiesColor }
		],
		npcTypes: [],
		fairnessWeight: 3,
		creatures: []
	});
	let reusableCharacters = $state<PlayerCharacter[]>([]);
	let newNpcTypeId = $state<StableId | ''>('');

	function updateChallengeName(name: string) {
		challenge.name = name;
	}

	function updateFairnessWeight(weight: number) {
		challenge.fairnessWeight = weight;
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
		if (npcType) npcType.initiativeStat = initiativeStat;
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
	}

	function addCharacter(factionId: StableId) {
		const name = nextNumberedName(
			'Player',
			reusableCharacters.map((character) => character.name)
		);

		const character = { id: createUuid(), name } satisfies PlayerCharacter;
		reusableCharacters.push(character);
		challenge.creatures.push({
			id: createUuid(),
			kind: 'character',
			characterId: character.id,
			factionId,
			isHidden: false,
			turns: [createTurn('manual')]
		});
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

	function updateCharacterName(characterId: StableId, name: string) {
		const character = reusableCharacters.find((item) => item.id === characterId);
		if (character) character.name = name;
	}

	function setTurnInitiative(creatureId: StableId, turnId: StableId, choice: InitiativeChoice) {
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		const turn = creature?.turns.find((item) => item.id === turnId);
		if (!turn) return;

		const otherTurn = challenge.creatures.find((item) => item.id !== creatureId)?.turns[0];
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

		if (change.kind === 'static-value' && initiative.kind === 'static') {
			initiative.value = change.value;
		} else if (change.kind === 'fixed-from' && initiative.kind === 'fixed-position') {
			initiative.from = change.from;
		} else if (change.kind === 'fixed-position' && initiative.kind === 'fixed-position') {
			initiative.position = change.position;
		} else if (change.kind === 'relative-relation' && initiative.kind === 'relative-position') {
			initiative.relation = change.relation;
		} else if (change.kind === 'relative-distance' && initiative.kind === 'relative-position') {
			initiative.distance = change.distance;
		} else if (change.kind === 'relative-target' && initiative.kind === 'relative-position') {
			initiative.targetTurnId = change.targetTurnId;
		}
	}

	function updateCreatureFaction(creatureId: StableId, factionId: StableId) {
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		if (creature) creature.factionId = factionId;
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
			if (challenge.runState.generatedTurnOrder) {
				challenge.runState.generatedTurnOrder = challenge.runState.generatedTurnOrder.filter(
					(turnId) => !turnIds.has(turnId)
				);
			}
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

<ViewPage title="New challenge">
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

		<CreatureSetup
			factions={challenge.factions}
			creatures={challenge.creatures}
			characters={reusableCharacters}
			npcTypes={challenge.npcTypes}
			npcTypeId={newNpcTypeId}
			onCreateFaction={addFaction}
			onRenameFaction={renameFaction}
			onFactionColorChange={updateFactionColor}
			onRemoveFaction={removeFaction}
			onCreateCharacter={addCharacter}
			onCreateNpc={addNpc}
			onCreatureFactionChange={updateCreatureFaction}
			onNpcTypeChange={updateNpcType}
			onCharacterNameChange={updateCharacterName}
			onNpcIdentifierChange={updateNpcIdentifier}
			onTurnChange={updateTurnInitiative}
			onAddTurn={addTurn}
			onRemoveTurn={removeTurn}
			onRemoveCreature={removeCreature}
		/>
	</div>
</ViewPage>
