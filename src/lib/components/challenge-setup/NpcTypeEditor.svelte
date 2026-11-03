<script lang="ts">
	import type { NpcType, StableId } from '#lib';

	interface Props {
		npcTypes: readonly NpcType[];
		selectedNpcTypeId: StableId | '';
		onCreate: () => void;
		onSelect: (npcTypeId: StableId) => void;
		onRename: (npcTypeId: StableId, name: string) => void;
		onInitiativeStatChange: (npcTypeId: StableId, initiativeStat: number) => void;
		onRemove: (npcTypeId: StableId) => void;
	}

	let {
		npcTypes,
		selectedNpcTypeId,
		onCreate,
		onSelect,
		onRename,
		onInitiativeStatChange,
		onRemove
	}: Props = $props();
</script>

<fieldset class="setup-section npc-type-strip-section">
	<legend>NPC types</legend>
	<button class="add-entity-button" type="button" onclick={onCreate}>Add NPC Type</button>
	{#if npcTypes.length > 0}
		<ul class="npc-type-list">
			{#each npcTypes as npcType (npcType.id)}
				<li>
					<fieldset class="npc-type-card">
						<legend>{npcType.name}</legend>
						<label>
							<span>NPC type name</span>
							<input
								aria-label={`NPC type name: ${npcType.name}`}
								value={npcType.name}
								oninput={(event) => onRename(npcType.id, event.currentTarget.value)}
							/>
						</label>
						<label>
							<span>Initiative stat (d6)</span>
							<input
								aria-label={`Initiative stat for ${npcType.name}`}
								value={npcType.initiativeStat}
								type="number"
								min="1"
								step="1"
								oninput={(event) =>
									onInitiativeStatChange(npcType.id, event.currentTarget.valueAsNumber)}
							/>
						</label>
						<div class="npc-type-actions">
							<button
								class="quiet-button"
								type="button"
								aria-pressed={selectedNpcTypeId === npcType.id}
								aria-label={`Use NPC type ${npcType.name}`}
								onclick={() => onSelect(npcType.id)}
							>
								{selectedNpcTypeId === npcType.id ? 'Selected' : 'Use'}
							</button>
							<button
								class="quiet-button warning-button"
								type="button"
								aria-label={`Remove NPC type ${npcType.name}`}
								onclick={() => onRemove(npcType.id)}
							>
								Remove
							</button>
						</div>
					</fieldset>
				</li>
			{/each}
		</ul>
	{/if}
</fieldset>
