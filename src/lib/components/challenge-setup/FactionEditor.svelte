<script lang="ts">
	import type { ChallengeCreature, Faction, NpcType, PlayerCharacter, StableId } from '#lib';
	import type { TurnEditorChange, TurnTarget } from './challenge-setup-types';
	import CharacterCreatureForm from './CharacterCreatureForm.svelte';
	import CreatureEditor from './CreatureEditor.svelte';
	import NpcCreatureForm from './NpcCreatureForm.svelte';

	interface Props {
		faction: Readonly<Faction>;
		factions: readonly Faction[];
		creatures: readonly ChallengeCreature[];
		characters: readonly PlayerCharacter[];
		npcTypes: readonly NpcType[];
		npcTypeId: StableId | '';
		onNpcTypeChange: (npcTypeId: StableId) => void;
		onRename: (factionId: StableId, name: string) => void;
		onRemove: (factionId: StableId) => void;
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
		faction,
		factions,
		creatures,
		characters,
		npcTypes,
		npcTypeId,
		onNpcTypeChange,
		onRename,
		onRemove,
		onCreateCharacter,
		onCreateNpc,
		onCreatureFactionChange,
		onCharacterNameChange,
		onNpcIdentifierChange,
		onTurnChange,
		onRemoveCreature
	}: Props = $props();
	let isAddingPlayer = $state(false);
	let isAddingNpc = $state(false);
	let factionCreatures = $derived(
		creatures.filter((creature) => creature.factionId === faction.id)
	);

	function characterName(characterId: StableId): string {
		return characters.find((character) => character.id === characterId)?.name ?? 'Character';
	}

	function npcName(creatureTypeId: StableId, identifier: string): string {
		const typeName = npcTypes.find((npcType) => npcType.id === creatureTypeId)?.name ?? 'NPC';
		return `${typeName} ${identifier}`.trim();
	}

	function targetTurns(excludedCreatureId: StableId): TurnTarget[] {
		return creatures.flatMap((creature) => {
			if (creature.id === excludedCreatureId) return [];
			const turn = creature.turns[0];
			if (!turn) return [];

			const name =
				creature.kind === 'character'
					? characterName(creature.characterId)
					: npcName(creature.creatureTypeId, creature.identifier);
			return [{ id: turn.id, name }];
		});
	}

	function savePlayer(name: string) {
		onCreateCharacter(faction.id, name);
		isAddingPlayer = false;
	}

	function saveNpc(identifier: string) {
		onCreateNpc(faction.id, identifier);
		isAddingNpc = false;
	}
</script>

<section class="faction-panel" aria-label={faction.name}>
	<div class="faction-heading">
		<label>
			<span>Faction name</span>
			<input
				aria-label={`Faction name: ${faction.name}`}
				value={faction.name}
				oninput={(event) => onRename(faction.id, event.currentTarget.value)}
			/>
		</label>
		<button
			class="quiet-button"
			type="button"
			aria-label={`Remove faction ${faction.name}`}
			onclick={() => onRemove(faction.id)}
		>
			Remove
		</button>
	</div>

	{#if factionCreatures.length > 0}
		<div class="faction-creatures">
			{#each factionCreatures as creature (creature.id)}
				{@const name =
					creature.kind === 'character'
						? characterName(creature.characterId)
						: npcName(creature.creatureTypeId, creature.identifier)}
				<CreatureEditor
					{creature}
					{name}
					characterName={creature.kind === 'character' ? characterName(creature.characterId) : ''}
					{factions}
					targetTurns={targetTurns(creature.id)}
					onFactionChange={onCreatureFactionChange}
					{onCharacterNameChange}
					{onNpcIdentifierChange}
					{onTurnChange}
					onRemove={onRemoveCreature}
				/>
			{/each}
		</div>
	{/if}

	<div class="faction-actions">
		<button type="button" onclick={() => (isAddingPlayer = true)}>Add Player</button>
		<button type="button" disabled={!npcTypes.length} onclick={() => (isAddingNpc = true)}>
			Add NPC
		</button>
	</div>

	{#if isAddingPlayer}
		<CharacterCreatureForm
			factionName={faction.name}
			onCreate={savePlayer}
			onCancel={() => (isAddingPlayer = false)}
		/>
	{/if}
	{#if isAddingNpc}
		<NpcCreatureForm
			factionName={faction.name}
			{npcTypes}
			{npcTypeId}
			{onNpcTypeChange}
			onCreate={saveNpc}
			onCancel={() => (isAddingNpc = false)}
		/>
	{/if}
</section>
