<script lang="ts">
	import type {
		ChallengeCreature,
		Faction,
		FactionColor,
		NpcType,
		PlayerCharacter,
		StableId,
		ValidationIssue
	} from '#lib';
	import type { TurnEditorChange } from './challenge-setup-types';
	import EntityList from '../EntityList.svelte';
	import FactionEditor from './FactionEditor.svelte';
	import Card from '../Card.svelte';

	interface Props {
		factions: readonly Faction[];
		creatures: readonly ChallengeCreature[];
		characters: readonly PlayerCharacter[];
		npcTypes: readonly NpcType[];
		setupIssues: readonly ValidationIssue[];
		npcTypeId: StableId | '';
		onCreateFaction: () => void;
		onRenameFaction: (factionId: StableId, name: string) => void;
		onFactionColorChange: (factionId: StableId, color: FactionColor) => void;
		onRemoveFaction: (factionId: StableId) => void;
		onCreateCharacter: (factionId: StableId) => void;
		onCreateNpc: (factionId: StableId) => void;
		onCreatureFactionChange: (creatureId: StableId, factionId: StableId) => void;
		onCreatureVisibilityChange: (creatureId: StableId, isHidden: boolean) => void;
		onMoveTurn: (creatureId: StableId, turnId: StableId, direction: 'up' | 'down') => void;
		onMoveCreature: (creatureId: StableId, direction: 'up' | 'down') => void;
		onNpcTypeChange: (creatureId: StableId, npcTypeId: StableId) => void;
		onCharacterNameChange: (characterId: StableId, name: string) => void;
		onCharacterInitiativeStatChange: (
			characterId: StableId,
			initiativeStat: number | undefined
		) => void;
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
		setupIssues,
		npcTypeId,
		onCreateFaction,
		onRenameFaction,
		onFactionColorChange,
		onRemoveFaction,
		onCreateCharacter,
		onCreateNpc,
		onCreatureFactionChange,
		onCreatureVisibilityChange,
		onMoveTurn,
		onMoveCreature,
		onNpcTypeChange,
		onCharacterNameChange,
		onCharacterInitiativeStatChange,
		onNpcIdentifierChange,
		onTurnChange,
		onAddTurn,
		onRemoveTurn,
		onRemoveCreature
	}: Props = $props();
</script>

<Card title="Factions" headerSize="large">
	<fieldset class="setup-section faction-board-section">
		<legend>Factions</legend>
		<EntityList addLabel="Add Faction" onAdd={onCreateFaction} layout="grid">
			{#each factions as faction (faction.id)}
				<FactionEditor
					{faction}
					{factions}
					{creatures}
					{characters}
					{npcTypes}
					{setupIssues}
					{npcTypeId}
					onRename={onRenameFaction}
					onColorChange={onFactionColorChange}
					onRemove={onRemoveFaction}
					{onCreateCharacter}
					{onCreateNpc}
					{onCreatureFactionChange}
					{onCreatureVisibilityChange}
					{onMoveTurn}
					{onMoveCreature}
					{onNpcTypeChange}
					{onCharacterNameChange}
					{onCharacterInitiativeStatChange}
					{onNpcIdentifierChange}
					{onTurnChange}
					{onAddTurn}
					{onRemoveTurn}
					{onRemoveCreature}
				/>
			{/each}
		</EntityList>
	</fieldset>
</Card>
