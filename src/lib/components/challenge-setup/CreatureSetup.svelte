<script lang="ts">
	import type { ChallengeCreature, Faction, NpcType, PlayerCharacter, StableId } from '#lib';
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
		onRemoveFaction: (factionId: StableId) => void;
		onCreateCharacter: (factionId: StableId) => void;
		onCreateNpc: (factionId: StableId) => void;
		onCreatureFactionChange: (creatureId: StableId, factionId: StableId) => void;
		onCharacterNameChange: (characterId: StableId, name: string) => void;
		onNpcIdentifierChange: (creatureId: StableId, identifier: string) => void;
		onTurnChange: (
			creatureId: StableId,
			turnId: StableId,
			change: Readonly<TurnEditorChange>
		) => void;
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
		onRemoveFaction,
		onCreateCharacter,
		onCreateNpc,
		onCreatureFactionChange,
		onCharacterNameChange,
		onNpcIdentifierChange,
		onTurnChange,
		onRemoveCreature
	}: Props = $props();
</script>

<section class="setup-section faction-board-section" aria-labelledby="factions-heading">
	<div class="section-heading">
		<h2 id="factions-heading">Factions</h2>
		<button type="button" onclick={onCreateFaction}>Add Faction</button>
	</div>
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
				onRemove={onRemoveFaction}
				{onCreateCharacter}
				{onCreateNpc}
				{onCreatureFactionChange}
				{onCharacterNameChange}
				{onNpcIdentifierChange}
				{onTurnChange}
				{onRemoveCreature}
			/>
		{/each}
	</div>
</section>
