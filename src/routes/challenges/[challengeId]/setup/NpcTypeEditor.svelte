<script lang="ts">
	import type { NpcType, StableId } from '#lib/challenge';
	import { Card, EntityList, EntityListItem, NumberInput, TextInput } from '#lib/components';

	interface Props {
		npcTypes: readonly NpcType[];
		onCreate: () => void;
		onRename: (npcTypeId: StableId, name: string) => void;
		onInitiativeStatChange: (npcTypeId: StableId, initiativeStat: number) => void;
		onRemove: (npcTypeId: StableId) => void;
	}

	let { npcTypes, onCreate, onRename, onInitiativeStatChange, onRemove }: Props = $props();
</script>

<Card title="NPC types" headerSize="large">
	<fieldset class="setup-section npc-type-strip-section">
		<legend>NPC types</legend>
		<EntityList addLabel="Add NPC Type" onAdd={onCreate} layout="strip">
			{#each npcTypes as npcType (npcType.id)}
				<Card
					title={npcType.name}
					headingLevel="h3"
					headerSize="small"
					variant="subtle"
					spacing="compact"
				>
					<EntityListItem
						class="npc-type-card"
						legend={npcType.name}
						removeLabel={`Remove NPC type ${npcType.name}`}
						removeText="Remove NPC type"
						onRemove={() => onRemove(npcType.id)}
					>
						<TextInput
							label="NPC type name"
							aria-label={`NPC type name: ${npcType.name}`}
							value={npcType.name}
							oninput={(event) => onRename(npcType.id, event.currentTarget.value)}
						/>
						<NumberInput
							label="Initiative stat (d6)"
							aria-label={`Initiative stat for ${npcType.name}`}
							value={npcType.initiativeStat}
							min="1"
							step="1"
							oninput={(event) =>
								onInitiativeStatChange(npcType.id, event.currentTarget.valueAsNumber)}
						/>
					</EntityListItem>
				</Card>
			{/each}
		</EntityList>
	</fieldset>
</Card>
