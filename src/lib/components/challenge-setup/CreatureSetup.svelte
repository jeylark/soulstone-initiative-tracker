<script lang="ts">
	import type {
		ChallengeCreature,
		Faction,
		FactionColor,
		NpcType,
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
		npcTypes: readonly NpcType[];
		setupIssues: readonly ValidationIssue[];
		npcTypeId: StableId | '';
		onCreateFaction: () => void;
		onRenameFaction: (factionId: StableId, name: string) => void;
		onFactionColorChange: (factionId: StableId, color: FactionColor) => void;
		onRemoveFaction: (factionId: StableId) => void;
		onCreateCharacter: (factionId: StableId) => void;
		onCreateNpc: (factionId: StableId) => void;
		onCreatureVisibilityChange: (creatureId: StableId, isHidden: boolean) => void;
		onNpcTypeChange: (creatureId: StableId, npcTypeId: StableId) => void;
		onCharacterNameChange: (creatureId: StableId, name: string) => void;
		onCharacterInitiativeStatChange: (
			creatureId: StableId,
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
		npcTypes,
		setupIssues,
		npcTypeId,
		onCreateFaction,
		onRenameFaction,
		onFactionColorChange,
		onRemoveFaction,
		onCreateCharacter,
		onCreateNpc,
		onCreatureVisibilityChange,
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
					{creatures}
					{npcTypes}
					{setupIssues}
					{npcTypeId}
					onRename={onRenameFaction}
					onColorChange={onFactionColorChange}
					onRemove={onRemoveFaction}
					{onCreateCharacter}
					{onCreateNpc}
					{onCreatureVisibilityChange}
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
