<script lang="ts">
	import type { ChallengeCreature, Faction, NpcType, StableId } from '#lib';
	import type { TurnEditorChange, TurnTarget } from './challenge-setup-types';
	import TurnEditor from './TurnEditor.svelte';
	import Card from '../Card.svelte';
	import EntityList from '../EntityList.svelte';
	import EntityListItem from '../EntityListItem.svelte';
	import SelectInput from '../forms/SelectInput.svelte';
	import TextInput from '../forms/TextInput.svelte';

	interface Props {
		creature: ChallengeCreature;
		name: string;
		characterName: string;
		factions: readonly Faction[];
		npcTypes: readonly NpcType[];
		targetTurns: readonly TurnTarget[];
		onFactionChange: (creatureId: StableId, factionId: StableId) => void;
		onVisibilityChange: (creatureId: StableId, isHidden: boolean) => void;
		onMoveTurn: (creatureId: StableId, turnId: StableId, direction: 'up' | 'down') => void;
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
		onRemove: (creatureId: StableId) => void;
	}

	let {
		creature,
		name,
		characterName,
		factions,
		npcTypes,
		targetTurns,
		onFactionChange,
		onVisibilityChange,
		onMoveTurn,
		onNpcTypeChange,
		onCharacterNameChange,
		onNpcIdentifierChange,
		onTurnChange,
		onAddTurn,
		onRemoveTurn,
		onRemove
	}: Props = $props();
</script>

<Card title={name} headingLevel="h4" headerSize="medium" spacing="compact">
	<EntityListItem
		class="creature"
		aria-label={name}
		legend={name}
		removeLabel={`Remove ${name}`}
		removeText="Remove creature"
		onRemove={() => onRemove(creature.id)}
	>
		<SelectInput
			label="Faction"
			value={creature.factionId}
			onchange={(event) => onFactionChange(creature.id, event.currentTarget.value as StableId)}
		>
			{#each factions as faction (faction.id)}
				<option value={faction.id}>{faction.name}</option>
			{/each}
		</SelectInput>
		{#if creature.kind === 'character'}
			<TextInput
				label="Character name"
				aria-label={`Character name: ${characterName}`}
				value={characterName}
				oninput={(event) => onCharacterNameChange(creature.characterId, event.currentTarget.value)}
			/>
		{:else if creature.kind === 'npc'}
			<SelectInput
				label="NPC type"
				aria-label={`NPC type for ${name}`}
				value={creature.creatureTypeId}
				onchange={(event) => onNpcTypeChange(creature.id, event.currentTarget.value as StableId)}
			>
				{#each npcTypes as npcType (npcType.id)}
					<option value={npcType.id}>{npcType.name}</option>
				{/each}
			</SelectInput>
			<TextInput
				label="NPC identifier"
				value={creature.identifier}
				oninput={(event) => onNpcIdentifierChange(creature.id, event.currentTarget.value)}
			/>
		{/if}
		<label class="creature-visibility">
			<input
				type="checkbox"
				checked={creature.isHidden}
				onchange={(event) => onVisibilityChange(creature.id, event.currentTarget.checked)}
			/>
			Hidden from viewers: {name}
		</label>
		<EntityList
			addLabel="Add turn"
			addAriaLabel={`Add turn for ${name}`}
			onAdd={() => onAddTurn(creature.id)}
		>
			{#each creature.turns as turn, index (turn.id)}
				<TurnEditor
					{turn}
					turnNumber={index + 1}
					creatureName={name}
					targetTurns={targetTurns.filter((target) => target.id !== turn.id)}
					canMoveUp={index > 0}
					canMoveDown={index < creature.turns.length - 1}
					onChange={(change) => onTurnChange(creature.id, turn.id, change)}
					onMove={(direction) => onMoveTurn(creature.id, turn.id, direction)}
					onRemove={() => onRemoveTurn(creature.id, turn.id)}
				/>
			{/each}
		</EntityList>
	</EntityListItem>
</Card>
