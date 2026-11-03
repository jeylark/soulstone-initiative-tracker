<script lang="ts">
	import type { ChallengeCreature, Faction, NpcType, PlayerCharacter, StableId } from '#lib';
	import type { TurnEditorChange, TurnTarget } from './challenge-setup-types';
	import CharacterCreatureForm from './CharacterCreatureForm.svelte';
	import CreatureEditor from './CreatureEditor.svelte';
	import NpcCreatureForm from './NpcCreatureForm.svelte';

	interface Props {
		creatures: readonly ChallengeCreature[];
		characters: readonly PlayerCharacter[];
		factions: readonly Faction[];
		npcTypes: readonly NpcType[];
		characterFactionId: StableId | '';
		npcFactionId: StableId | '';
		npcTypeId: StableId | '';
		onCharacterFactionChange: (factionId: StableId) => void;
		onNpcFactionChange: (factionId: StableId) => void;
		onNpcTypeChange: (npcTypeId: StableId) => void;
		onCreateCharacter: (name: string) => void;
		onCreateNpc: (identifier: string) => void;
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
		creatures,
		characters,
		factions,
		npcTypes,
		characterFactionId,
		npcFactionId,
		npcTypeId,
		onCharacterFactionChange,
		onNpcFactionChange,
		onNpcTypeChange,
		onCreateCharacter,
		onCreateNpc,
		onCreatureFactionChange,
		onCharacterNameChange,
		onNpcIdentifierChange,
		onTurnChange,
		onRemoveCreature
	}: Props = $props();

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
</script>

<section class="setup-section" aria-labelledby="creatures-heading">
	<div class="section-heading">
		<h2 id="creatures-heading">Creatures</h2>
	</div>
	<div class="add-creature-forms">
		<CharacterCreatureForm
			{factions}
			factionId={characterFactionId}
			onFactionChange={onCharacterFactionChange}
			onCreate={onCreateCharacter}
		/>
		<NpcCreatureForm
			{factions}
			{npcTypes}
			factionId={npcFactionId}
			{npcTypeId}
			onFactionChange={onNpcFactionChange}
			{onNpcTypeChange}
			onCreate={onCreateNpc}
		/>
	</div>

	{#if creatures.length > 0}
		<div class="creature-list">
			{#each creatures as creature (creature.id)}
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
</section>
