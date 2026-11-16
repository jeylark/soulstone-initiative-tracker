<script lang="ts">
	import type { NpcType, StableId, ValidationIssue } from '#lib/challenge';
	import { Card, EntityList, FormGroup, NumberInput, TextInput } from '#lib/components';
	import { issueMessage } from './issue-messages';

	interface Props {
		npcTypes: readonly NpcType[];
		setupIssues: readonly ValidationIssue[];
		canManageNpcTypes: boolean;
		isNpcTypeConfigurable: (npcTypeId: StableId) => boolean;
		creationError: string;
		onCreate: () => void;
		onRename: (npcTypeId: StableId, name: string) => void;
		onInitiativeStatChange: (npcTypeId: StableId, initiativeStat: number) => void;
		onRemove: (npcTypeId: StableId) => void;
	}

	let {
		npcTypes,
		setupIssues,
		canManageNpcTypes,
		isNpcTypeConfigurable,
		creationError,
		onCreate,
		onRename,
		onInitiativeStatChange,
		onRemove
	}: Props = $props();
</script>

<Card title="NPC types" headerSize="large">
	<fieldset class="setup-section npc-type-strip-section">
		<legend class="visually-hidden" data-visually-hidden>NPC types</legend>
		{#if creationError}<p role="alert">{creationError}</p>{/if}
		<EntityList
			entities={npcTypes}
			adds={[{ label: 'Add NPC Type', isDisabled: !canManageNpcTypes, onAdd: onCreate }]}
			layout="strip"
			legendSelector={(npcType) => npcType.name}
			removeLabelSelector={(npcType) => `Remove NPC type ${npcType.name}`}
			itemOptionsSelector={(npcType) => ({
				headingLevel: 'h3',
				headerSize: 'small',
				variant: 'subtle',
				spacing: 'compact',
				removeText: 'Remove NPC type',
				isRemoveDisabled: !canManageNpcTypes,
				fieldsetAttributes: { class: 'npc-type-card', ['data-entity-id']: npcType.id }
			})}
			onRemove={(npcType) => onRemove(npcType.id)}
		>
			{#snippet entityEditor(npcType, index)}
				{@const nameError = issueMessage(setupIssues, `$.npcTypes[${index}].name`)}
				{@const statError = issueMessage(setupIssues, `$.npcTypes[${index}].initiativeStat`)}
				<FormGroup class="npc-type-fields">
					<TextInput
						label="NPC type name"
						aria-label={`NPC type name: ${npcType.name}`}
						value={npcType.name}
						disabled={!isNpcTypeConfigurable(npcType.id)}
						isInvalid={nameError !== undefined}
						invalidMessage={nameError}
						oninput={(event) => onRename(npcType.id, event.currentTarget.value)}
					/>
					<NumberInput
						label="Initiative"
						aria-label={`Initiative stat for ${npcType.name}`}
						value={npcType.initiativeStat}
						disabled={!isNpcTypeConfigurable(npcType.id)}
						min="0"
						step="1"
						isInvalid={statError !== undefined}
						invalidMessage={statError}
						oninput={(event) => {
							const value = event.currentTarget.valueAsNumber;
							if (Number.isFinite(value)) onInitiativeStatChange(npcType.id, value);
						}}
					/>
				</FormGroup>
			{/snippet}
		</EntityList>
	</fieldset>
</Card>
