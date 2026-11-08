<script lang="ts">
	import type {
		ChallengeCreature,
		Faction,
		NpcType,
		StableId,
		ValidationIssue
	} from '#lib/challenge';
	import type { TurnEditorChange, TurnTarget } from './challenge-setup-types';
	import { issueMessage } from './issue-messages';
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
		setupIssues: readonly ValidationIssue[];
		issuePath: string;
		npcTypes: readonly NpcType[];
		factions?: readonly Faction[];
		onFactionChange?: (creatureId: StableId, factionId: StableId) => void;
		targetTurns: readonly TurnTarget[];
		siblingCount: (turnId: StableId) => number;
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
		setupIssues,
		issuePath,
		npcTypes,
		factions = [],
		onFactionChange,
		targetTurns,
		siblingCount,
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

	let nameError = $derived(issueMessage(setupIssues, `${issuePath}.name`));
	let identifierError = $derived(issueMessage(setupIssues, `${issuePath}.identifier`));
	let initiativeStatError = $derived(issueMessage(setupIssues, `${issuePath}.initiativeStat`));
	let factionError = $derived(issueMessage(setupIssues, `${issuePath}.factionId`));
	let npcTypeError = $derived(issueMessage(setupIssues, `${issuePath}.creatureTypeId`));

	const hasAppRollTurn = $derived(
		creature.turns.some((turn) => turn.initiative.kind === 'roll' && turn.initiative.mode === 'app')
	);
</script>

<Card title={name} headingLevel="h4" headerSize="medium" spacing="compact">
	<EntityListItem
		class="creature"
		data-entity-id={creature.id}
		aria-label={name}
		legend={name}
		removeLabel={`Remove ${name}`}
		removeText="Remove creature"
		onRemove={() => onRemove(creature.id)}
	>
		{#if onFactionChange}
			<SelectInput
				label="Faction"
				aria-label={`Faction for ${name}`}
				value={creature.factionId}
				isInvalid={factionError !== undefined}
				invalidMessage={factionError}
				onchange={(event) => onFactionChange?.(creature.id, event.currentTarget.value as StableId)}
			>
				<option value={creature.factionId} disabled>Missing faction</option>
				{#each factions as faction (faction.id)}<option value={faction.id}>{faction.name}</option
					>{/each}
			</SelectInput>
		{/if}
		{#if creature.kind === 'character'}
			<TextInput
				label="Character name"
				aria-label={`Character name: ${characterName}`}
				value={characterName}
				isInvalid={nameError !== undefined}
				invalidMessage={nameError}
				oninput={(event) => onCharacterNameChange(creature.id, event.currentTarget.value)}
			/>
			{#if hasAppRollTurn}
				<NumberInput
					label="Initiative stat (d6)"
					aria-label={`Initiative stat (d6) for ${characterName}`}
					value={characterInitiativeStat ?? ''}
					min="0"
					step="1"
					isInvalid={initiativeStatError !== undefined}
					invalidMessage={initiativeStatError}
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
				isInvalid={npcTypeError !== undefined}
				invalidMessage={npcTypeError}
				onchange={(event) => onNpcTypeChange(creature.id, event.currentTarget.value as StableId)}
			>
				{#if !npcTypes.some((npcType) => creature.kind === 'npc' && npcType.id === creature.creatureTypeId)}
					<option value={creature.creatureTypeId} disabled>Missing NPC type</option>
				{/if}
				{#each npcTypes as npcType (npcType.id)}
					<option value={npcType.id}>{npcType.name}</option>
				{/each}
			</SelectInput>
			<TextInput
				label="NPC identifier"
				value={creature.identifier}
				isInvalid={identifierError !== undefined}
				invalidMessage={identifierError}
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
					{setupIssues}
					issuePath={`${issuePath}.turns[${index}].initiative`}
					creatureName={name}
					targetTurns={targetTurns.filter((target) => target.id !== turn.id)}
					siblingCount={siblingCount(turn.id)}
					onChange={(change) => onTurnChange(creature.id, turn.id, change)}
					onRemove={() => onRemoveTurn(creature.id, turn.id)}
				/>
			{/each}
		</EntityList>
	</EntityListItem>
</Card>
