<script lang="ts">
	import type {
		ChallengeCreature,
		Faction,
		FactionColor,
		NpcType,
		PlayerCharacter,
		StableId
	} from '#lib';
	import type { TurnEditorChange } from './challenge-setup-types';
	import FactionEditor from './FactionEditor.svelte';

	interface Props {
		factions: readonly Faction[];
		creatures: readonly ChallengeCreature[];
		characters: readonly PlayerCharacter[];
		npcTypes: readonly NpcType[];
		npcTypeId: StableId | '';
		onCreateFaction: () => void;
		onRenameFaction: (factionId: StableId, name: string) => void;
		onFactionColorChange: (factionId: StableId, color: FactionColor) => void;
		onRemoveFaction: (factionId: StableId) => void;
		onCreateCharacter: (factionId: StableId) => void;
		onCreateNpc: (factionId: StableId) => void;
		onCreatureFactionChange: (creatureId: StableId, factionId: StableId) => void;
		onNpcTypeChange: (creatureId: StableId, npcTypeId: StableId) => void;
		onCharacterNameChange: (characterId: StableId, name: string) => void;
		onNpcIdentifierChange: (creatureId: StableId, identifier: string) => void;
		onTurnChange: (
			creatureId: StableId,
			turnId: StableId,
			change: Readonly<TurnEditorChange>
		) => void;
		onAddTurn: (creatureId: StableId) => void;
		onRemoveTurn: (creatureId: StableId, turnId: StableId) => void;
		onRemoveCreature: (creatureId: StableId) => void;
	}

	let {
		factions,
		creatures,
		characters,
		npcTypes,
		npcTypeId,
		onCreateFaction,
		onRenameFaction,
		onFactionColorChange,
		onRemoveFaction,
		onCreateCharacter,
		onCreateNpc,
		onCreatureFactionChange,
		onNpcTypeChange,
		onCharacterNameChange,
		onNpcIdentifierChange,
		onTurnChange,
		onAddTurn,
		onRemoveTurn,
		onRemoveCreature
	}: Props = $props();
</script>

<fieldset class="setup-section faction-board-section">
	<legend>Factions</legend>
	<button class="add-entity-button" type="button" onclick={onCreateFaction}>Add Faction</button>
	<div class="faction-board">
		{#each factions as faction (faction.id)}
			<FactionEditor
				{faction}
				{factions}
				{creatures}
				{characters}
				{npcTypes}
				{npcTypeId}
				onRename={onRenameFaction}
				onColorChange={onFactionColorChange}
				onRemove={onRemoveFaction}
				{onCreateCharacter}
				{onCreateNpc}
				{onCreatureFactionChange}
				{onNpcTypeChange}
				{onCharacterNameChange}
				{onNpcIdentifierChange}
				{onTurnChange}
				{onAddTurn}
				{onRemoveTurn}
				{onRemoveCreature}
			/>
		{/each}
	</div>
</fieldset>
