<script lang="ts">
	import {
		createUuid,
		type Challenge,
		type Faction,
		type NpcType,
		type PlayerCharacter,
		type StableId,
		type Turn
	} from '#lib';
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
	let challenge = $state<Challenge>({
		id: createUuid(),
		name: '',
		createdAt,
		updatedAt: createdAt,
		factions: [
			{ id: createUuid(), name: 'Players' },
			{ id: createUuid(), name: 'Enemies' }
		],
		npcTypes: [],
		fairnessWeight: 0,
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
		const faction = { id: createUuid(), name } satisfies Faction;
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

	function removeFaction(factionId: StableId) {
		const faction = challenge.factions.find((item) => item.id === factionId);
		if (!faction) return;

		const creatureCount = challenge.creatures.filter(
			(creature) => creature.factionId === factionId
		).length;
		if (
			creatureCount > 0 &&
			!window.confirm(
				`Remove faction "${faction.name}" and its ${creatureCount} creature${creatureCount === 1 ? '' : 's'}? Its creatures will also be deleted.`
			)
		) {
			return;
		}
		challenge.creatures = challenge.creatures.filter(
			(creature) => creature.factionId !== factionId
		);
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

		const npcCount = challenge.creatures.filter(
			(creature) => creature.kind === 'npc' && creature.creatureTypeId === npcTypeId
		).length;
		if (
			npcCount > 0 &&
			!window.confirm(
				`Remove NPC type "${npcType.name}" and its ${npcCount} NPC${npcCount === 1 ? '' : 's'}? Those NPCs will also be deleted.`
			)
		) {
			return;
		}
		challenge.creatures = challenge.creatures.filter(
			(creature) => creature.kind !== 'npc' || creature.creatureTypeId !== npcTypeId
		);
		challenge.npcTypes = challenge.npcTypes.filter((npcType) => npcType.id !== npcTypeId);
		if (newNpcTypeId === npcTypeId) newNpcTypeId = challenge.npcTypes[0]?.id ?? '';
	}

	function createTurn(): Turn {
		return { id: createUuid(), isHidden: false, initiative: { kind: 'roll' } };
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
			turns: [createTurn()]
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
			turns: [createTurn()]
		});
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
		if (choice === 'none') turn.initiative = null;
		else if (choice === 'roll') turn.initiative = { kind: 'roll' };
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

	function removeCreature(creatureId: StableId) {
		challenge.creatures = challenge.creatures.filter((creature) => creature.id !== creatureId);
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
			selectedNpcTypeId={newNpcTypeId}
			onCreate={addNpcType}
			onSelect={(npcTypeId) => (newNpcTypeId = npcTypeId)}
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
			onRemoveFaction={removeFaction}
			onCreateCharacter={addCharacter}
			onCreateNpc={addNpc}
			onCreatureFactionChange={updateCreatureFaction}
			onCharacterNameChange={updateCharacterName}
			onNpcIdentifierChange={updateNpcIdentifier}
			onTurnChange={updateTurnInitiative}
			onRemoveCreature={removeCreature}
		/>
	</div>
</ViewPage>
