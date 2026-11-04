<script lang="ts">
	import type { NpcType, StableId } from '#lib';
	import ActionButton from '../ActionButton.svelte';
	import Card from '../Card.svelte';
	import NumberInput from '../forms/NumberInput.svelte';
	import TextInput from '../forms/TextInput.svelte';

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
		<ActionButton class="add-entity-button" onclick={onCreate}>Add NPC Type</ActionButton>
		{#if npcTypes.length > 0}
			<ul class="npc-type-list">
				{#each npcTypes as npcType (npcType.id)}
					<li>
						<Card
							title={npcType.name}
							headingLevel="h3"
							headerSize="small"
							variant="subtle"
							spacing="compact"
						>
							<fieldset class="npc-type-card">
								<legend>{npcType.name}</legend>
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
								<ActionButton
									variant="danger"
									aria-label={`Remove NPC type ${npcType.name}`}
									onclick={() => onRemove(npcType.id)}
								>
									Remove
								</ActionButton>
							</fieldset>
						</Card>
					</li>
				{/each}
			</ul>
		{/if}
	</fieldset>
</Card>
