<script lang="ts">
	import type { ChallengeCreature, NpcType, StableId } from '#lib/challenge';
	import type { TurnEditorChange, TurnTarget } from './challenge-setup-types';
	import TurnEditor from './TurnEditor.svelte';
	import {
		Card,
		CheckboxInput,
		EntityList,
		EntityListItem,
		NumberInput,
		SelectInput,
		TextInput
	} from '#lib/components';

	interface Props {
		creature: ChallengeCreature;
		name: string;
		characterName: string;
		characterInitiativeStat?: number;
		characterInitiativeStatError?: string;
		npcTypes: readonly NpcType[];
		targetTurns: readonly TurnTarget[];
		onVisibilityChange: (creatureId: StableId, isHidden: boolean) => void;
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
		onRemove: (creatureId: StableId) => void;
	}

	let {
		creature,
		name,
		characterName,
		characterInitiativeStat,
		characterInitiativeStatError,
		npcTypes,
		targetTurns,
		onVisibilityChange,
		onNpcTypeChange,
		onCharacterNameChange,
		onCharacterInitiativeStatChange,
		onNpcIdentifierChange,
		onTurnChange,
		onAddTurn,
		onRemoveTurn,
		onRemove
	}: Props = $props();

	const hasAppRollTurn = $derived(
		creature.turns.some((turn) => turn.initiative.kind === 'roll' && turn.initiative.mode === 'app')
	);
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
		{#if creature.kind === 'character'}
			<TextInput
				label="Character name"
				aria-label={`Character name: ${characterName}`}
				value={characterName}
				oninput={(event) => onCharacterNameChange(creature.id, event.currentTarget.value)}
			/>
			{#if hasAppRollTurn}
				<NumberInput
					label="Initiative stat (d6)"
					aria-label={`Initiative stat (d6) for ${characterName}`}
					value={characterInitiativeStat ?? ''}
					min="1"
					step="1"
					isInvalid={characterInitiativeStatError !== undefined}
					invalidMessage={characterInitiativeStatError}
					oninput={(event) => {
						const value = event.currentTarget.valueAsNumber;
						onCharacterInitiativeStatChange(
							creature.id,
							Number.isFinite(value) ? value : undefined
						);
					}}
				/>
			{/if}
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
		<div class="creature-visibility">
			<CheckboxInput
				label={`Hidden from viewers: ${name}`}
				checked={creature.isHidden}
				onchange={(event) => onVisibilityChange(creature.id, event.currentTarget.checked)}
			/>
		</div>
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
					onChange={(change) => onTurnChange(creature.id, turn.id, change)}
					onRemove={() => onRemoveTurn(creature.id, turn.id)}
				/>
			{/each}
		</EntityList>
	</EntityListItem>
</Card>
