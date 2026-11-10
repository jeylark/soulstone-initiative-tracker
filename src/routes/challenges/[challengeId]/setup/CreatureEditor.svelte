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
		canManageCreaturesAndTurns: boolean;
		isConfigurable: boolean;
		isTurnConfigurable: (turnId: StableId) => boolean;
		onVisibilityChange: (creatureId: StableId, isHidden: boolean) => void;
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
		canManageCreaturesAndTurns,
		isConfigurable,
		isTurnConfigurable,
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

<EntityListItem
	headingLevel="h4"
	headerSize="medium"
	spacing="compact"
	class="creature"
	data-entity-id={creature.id}
	aria-label={name}
	legend={name}
	removeLabel={`Remove ${name}`}
	removeText="Remove creature"
	isRemoveDisabled={!canManageCreaturesAndTurns}
	onRemove={() => onRemove(creature.id)}
>
	{#if onFactionChange}
		<SelectInput
			label="Faction"
			aria-label={`Faction for ${name}`}
			value={creature.factionId}
			disabled={!isConfigurable}
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
			disabled={!isConfigurable}
			isInvalid={nameError !== undefined}
			invalidMessage={nameError}
			oninput={(event) => onCharacterNameChange(creature.id, event.currentTarget.value)}
		/>
		{#if hasAppRollTurn}
			<NumberInput
				label="Initiative stat (d6)"
				aria-label={`Initiative stat (d6) for ${characterName}`}
				value={characterInitiativeStat ?? ''}
				disabled={!isConfigurable}
				min="0"
				step="1"
				isInvalid={initiativeStatError !== undefined}
				invalidMessage={initiativeStatError}
				oninput={(event) => {
					const value = event.currentTarget.valueAsNumber;
					onCharacterInitiativeStatChange(creature.id, Number.isFinite(value) ? value : undefined);
				}}
			/>
		{/if}
	{:else if creature.kind === 'npc'}
		<SelectInput
			label="NPC type"
			aria-label={`NPC type for ${name}`}
			value={creature.creatureTypeId}
			disabled={!isConfigurable}
			isInvalid={npcTypeError !== undefined}
			invalidMessage={npcTypeError}
			onchange={(event) => {
				const isAccepted = onNpcTypeChange(creature.id, event.currentTarget.value as StableId);
				if (!isAccepted) event.currentTarget.value = creature.creatureTypeId;
			}}
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
			disabled={!isConfigurable}
			isInvalid={identifierError !== undefined}
			invalidMessage={identifierError}
			oninput={(event) => onNpcIdentifierChange(creature.id, event.currentTarget.value)}
		/>
	{/if}
	<div class="creature-visibility">
		<CheckboxInput
			label={`Hidden from viewers: ${name}`}
			checked={creature.isHidden}
			disabled={!isConfigurable}
			onchange={(event) => onVisibilityChange(creature.id, event.currentTarget.checked)}
		/>
	</div>
	<EntityList
		addLabel="Add turn"
		addAriaLabel={`Add turn for ${name}`}
		isAddDisabled={!canManageCreaturesAndTurns}
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
				isConfigurable={isTurnConfigurable(turn.id)}
				isRemovalDisabled={!canManageCreaturesAndTurns}
				onChange={(change) => onTurnChange(creature.id, turn.id, change)}
				onRemove={() => onRemoveTurn(creature.id, turn.id)}
			/>
		{/each}
	</EntityList>
</EntityListItem>
