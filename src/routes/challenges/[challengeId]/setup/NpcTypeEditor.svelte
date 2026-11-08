<script lang="ts">
	import type { NpcType, StableId, ValidationIssue } from '#lib/challenge';
	import { Card, EntityList, EntityListItem, NumberInput, TextInput } from '#lib/components';
	import { issueMessage } from './issue-messages';

	interface Props {
		npcTypes: readonly NpcType[];
		setupIssues: readonly ValidationIssue[];
		onCreate: () => void;
		onRename: (npcTypeId: StableId, name: string) => void;
		onInitiativeStatChange: (npcTypeId: StableId, initiativeStat: number) => void;
		onRemove: (npcTypeId: StableId) => void;
	}

	let { npcTypes, setupIssues, onCreate, onRename, onInitiativeStatChange, onRemove }: Props =
		$props();
</script>

<Card title="NPC types" headerSize="large">
	<fieldset class="setup-section npc-type-strip-section">
		<legend>NPC types</legend>
		<EntityList addLabel="Add NPC Type" onAdd={onCreate} layout="strip">
			{#each npcTypes as npcType, index (npcType.id)}
				{@const nameError = issueMessage(setupIssues, `$.npcTypes[${index}].name`)}
				{@const statError = issueMessage(setupIssues, `$.npcTypes[${index}].initiativeStat`)}
				<Card
					title={npcType.name}
					headingLevel="h3"
					headerSize="small"
					variant="subtle"
					spacing="compact"
				>
					<EntityListItem
						class="npc-type-card"
						data-entity-id={npcType.id}
						legend={npcType.name}
						removeLabel={`Remove NPC type ${npcType.name}`}
						removeText="Remove NPC type"
						onRemove={() => onRemove(npcType.id)}
					>
						<TextInput
							label="NPC type name"
							aria-label={`NPC type name: ${npcType.name}`}
							value={npcType.name}
							isInvalid={nameError !== undefined}
							invalidMessage={nameError}
							oninput={(event) => onRename(npcType.id, event.currentTarget.value)}
						/>
						<NumberInput
							label="Initiative stat (d6)"
							aria-label={`Initiative stat for ${npcType.name}`}
							value={npcType.initiativeStat}
							min="0"
							step="1"
							isInvalid={statError !== undefined}
							invalidMessage={statError}
							oninput={(event) => {
								const value = event.currentTarget.valueAsNumber;
								if (Number.isFinite(value)) onInitiativeStatChange(npcType.id, value);
							}}
						/>
					</EntityListItem>
				</Card>
			{/each}
		</EntityList>
	</fieldset>
</Card>
