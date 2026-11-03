<script lang="ts">
	import type { ChallengeCreature, Faction, NpcType, PlayerCharacter, StableId } from '#lib';
	import type { TurnEditorChange, TurnTarget } from './challenge-setup-types';
	import CreatureEditor from './CreatureEditor.svelte';

	interface Props {
		faction: Readonly<Faction>;
		factions: readonly Faction[];
		creatures: readonly ChallengeCreature[];
		characters: readonly PlayerCharacter[];
		npcTypes: readonly NpcType[];
		npcTypeId: StableId | '';
		onRename: (factionId: StableId, name: string) => void;
		onRemove: (factionId: StableId) => void;
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
		onAddTurn: (creatureId: StableId) => void;
		onRemoveTurn: (creatureId: StableId, turnId: StableId) => void;
		onRemoveCreature: (creatureId: StableId) => void;
	}

	let {
		faction,
		factions,
		creatures,
		characters,
		npcTypes,
		npcTypeId,
		onRename,
		onRemove,
		onCreateCharacter,
		onCreateNpc,
		onCreatureFactionChange,
		onCharacterNameChange,
		onNpcIdentifierChange,
		onTurnChange,
		onAddTurn,
		onRemoveTurn,
		onRemoveCreature
	}: Props = $props();
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

	function targetTurns(): TurnTarget[] {
		return creatures.flatMap((creature) => {
			const name =
				creature.kind === 'character'
					? characterName(creature.characterId)
					: npcName(creature.creatureTypeId, creature.identifier);
			return creature.turns.map((turn, index) => ({
				id: turn.id,
				name: `${name} - Turn ${index + 1}`
			}));
		});
	}
</script>

<fieldset class="faction-panel">
	<legend>{faction.name}</legend>
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
			class="quiet-button warning-button"
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
					targetTurns={targetTurns()}
					onFactionChange={onCreatureFactionChange}
					{onCharacterNameChange}
					{onNpcIdentifierChange}
					{onTurnChange}
					{onAddTurn}
					{onRemoveTurn}
					onRemove={onRemoveCreature}
				/>
			{/each}
		</div>
	{/if}

	<div class="faction-actions">
		<button type="button" onclick={() => onCreateCharacter(faction.id)}>Add Player</button>
		<button type="button" disabled={!npcTypeId} onclick={() => onCreateNpc(faction.id)}>
			Add NPC
		</button>
	</div>
</fieldset>
