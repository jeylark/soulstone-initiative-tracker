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
		onNpcTypeChange: (npcTypeId: StableId) => void;
		onCreateFaction: (name: string) => void;
		onRenameFaction: (factionId: StableId, name: string) => void;
		onRemoveFaction: (factionId: StableId) => void;
		onCreateCharacter: (factionId: StableId, name: string) => void;
		onCreateNpc: (factionId: StableId, identifier: string) => void;
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
		onNpcTypeChange,
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
	let isAddingFaction = $state(false);
	let newFactionName = $state('');

	function submitFaction() {
		const name = newFactionName.trim();
		if (!name) return;

		onCreateFaction(name);
		newFactionName = '';
		isAddingFaction = false;
	}
</script>

<section class="setup-section faction-board-section" aria-labelledby="factions-heading">
	<div class="section-heading">
		<h2 id="factions-heading">Factions</h2>
		<button type="button" onclick={() => (isAddingFaction = true)}>Add faction</button>
	</div>
	{#if isAddingFaction}
		<form
			class="inline-form"
			onsubmit={(event) => {
				event.preventDefault();
				submitFaction();
			}}
		>
			<label>
				<span>New faction name</span>
				<input bind:value={newFactionName} required />
			</label>
			<button type="submit">Save faction</button>
			<button
				class="quiet-button"
				type="button"
				onclick={() => {
					newFactionName = '';
					isAddingFaction = false;
				}}
			>
				Cancel
			</button>
		</form>
	{/if}
	<div class="faction-board">
		{#each factions as faction (faction.id)}
			<FactionEditor
				{faction}
				{factions}
				{creatures}
				{characters}
				{npcTypes}
				{npcTypeId}
				{onNpcTypeChange}
				onRename={onRenameFaction}
				onRemove={onRemoveFaction}
				onCreateCharacter={(factionId, name) => onCreateCharacter(factionId, name)}
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
