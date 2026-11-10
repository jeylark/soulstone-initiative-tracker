<script lang="ts">
	import type {
		ChallengeCreature,
		Faction,
		FactionColor,
		NpcType,
		StableId,
		ValidationIssue
	} from '#lib/challenge';
	import type { TurnEditorChange } from './challenge-setup-types';
	import FactionEditor from './FactionEditor.svelte';
	import { Card, EntityList } from '#lib/components';

	interface Props {
		factions: readonly Faction[];
		creatures: readonly ChallengeCreature[];
		npcTypes: readonly NpcType[];
		setupIssues: readonly ValidationIssue[];
		npcTypeId: StableId | '';
		canManageFactions: boolean;
		canManageCreaturesAndTurns: boolean;
		isCreatureConfigurable: (creatureId: StableId) => boolean;
		isTurnConfigurable: (turnId: StableId) => boolean;
		onCreateFaction: () => void;
		onRenameFaction: (factionId: StableId, name: string) => void;
		onFactionColorChange: (factionId: StableId, color: FactionColor) => void;
		onRemoveFaction: (factionId: StableId) => void;
		onCreateCharacter: (factionId: StableId) => void;
		onCreateNpc: (factionId: StableId) => void;
		onCreatureVisibilityChange: (creatureId: StableId, isHidden: boolean) => void;
		onCreatureFactionChange?: (creatureId: StableId, factionId: StableId) => void;
		onNpcTypeChange: (creatureId: StableId, npcTypeId: StableId) => boolean;
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
		canManageFactions,
		canManageCreaturesAndTurns,
		isCreatureConfigurable,
		isTurnConfigurable,
		onCreateFaction,
		onRenameFaction,
		onFactionColorChange,
		onRemoveFaction,
		onCreateCharacter,
		onCreateNpc,
		onCreatureVisibilityChange,
		onCreatureFactionChange,
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
		<EntityList
			entities={factions}
			adds={[{ label: 'Add Faction', isDisabled: !canManageFactions, onAdd: onCreateFaction }]}
			layout="grid"
			legendSelector={(faction) => faction.name}
			removeLabelSelector={(faction) => `Remove faction ${faction.name}`}
			itemOptionsSelector={(faction) => ({
				headingLevel: 'h3',
				headerSize: 'medium',
				variant: 'inset',
				spacing: 'compact',
				removeText: 'Remove faction',
				isRemoveDisabled: !canManageFactions,
				fieldsetAttributes: { class: 'faction-panel', ['data-entity-id']: faction.id }
			})}
			onRemove={(faction) => onRemoveFaction(faction.id)}
		>
			{#snippet entityEditor(faction, factionIndex)}
				<FactionEditor
					{faction}
					{factionIndex}
					{creatures}
					{npcTypes}
					{setupIssues}
					{npcTypeId}
					{canManageFactions}
					{canManageCreaturesAndTurns}
					{isCreatureConfigurable}
					{isTurnConfigurable}
					onRename={onRenameFaction}
					onColorChange={onFactionColorChange}
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
			{/snippet}
			{#snippet afterEntities()}
				{#if creatures.some((creature) => !factions.some((faction) => faction.id === creature.factionId))}
					<FactionEditor
						{factions}
						{creatures}
						{npcTypes}
						{setupIssues}
						{npcTypeId}
						{canManageFactions}
						{canManageCreaturesAndTurns}
						{isCreatureConfigurable}
						{isTurnConfigurable}
						factionIndex={-1}
						onRename={onRenameFaction}
						onColorChange={onFactionColorChange}
						{onCreateCharacter}
						{onCreateNpc}
						{onCreatureVisibilityChange}
						{onCreatureFactionChange}
						{onNpcTypeChange}
						{onCharacterNameChange}
						{onCharacterInitiativeStatChange}
						{onNpcIdentifierChange}
						{onTurnChange}
						{onAddTurn}
						{onRemoveTurn}
						{onRemoveCreature}
					/>
				{/if}
			{/snippet}
		</EntityList>
	</fieldset>
</Card>
