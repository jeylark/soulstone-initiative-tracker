<script lang="ts">
	import type { NpcType, StableId } from '#lib';

	interface Props {
		npcTypes: readonly NpcType[];
		usedNpcTypeIds: ReadonlySet<StableId>;
		onCreate: (name: string, initiativeStat: number) => void;
		onRename: (npcTypeId: StableId, name: string) => void;
		onInitiativeStatChange: (npcTypeId: StableId, initiativeStat: number) => void;
		onRemove: (npcTypeId: StableId) => void;
	}

	let { npcTypes, usedNpcTypeIds, onCreate, onRename, onInitiativeStatChange, onRemove }: Props =
		$props();
	let isAdding = $state(false);
	let newName = $state('');
	let newInitiativeStat = $state(1);

	function submit() {
		const name = newName.trim();
		if (!name || !Number.isSafeInteger(newInitiativeStat) || newInitiativeStat < 1) return;

		onCreate(name, newInitiativeStat);
		newName = '';
		newInitiativeStat = 1;
		isAdding = false;
	}
</script>

<section class="setup-section" aria-labelledby="npc-types-heading">
	<div class="section-heading">
		<h2 id="npc-types-heading">NPC types</h2>
		<button type="button" onclick={() => (isAdding = true)}>Add NPC type</button>
	</div>
	{#if npcTypes.length > 0}
		<ul class="entity-list">
			{#each npcTypes as npcType (npcType.id)}
				<li>
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
					<button
						class="quiet-button"
						type="button"
						disabled={usedNpcTypeIds.has(npcType.id)}
						aria-label={`Remove NPC type ${npcType.name}`}
						title="Types used by creatures cannot be removed"
						onclick={() => onRemove(npcType.id)}
					>
						Remove
					</button>
				</li>
			{/each}
		</ul>
	{/if}
	{#if isAdding}
		<form
			class="inline-form"
			onsubmit={(event) => {
				event.preventDefault();
				submit();
			}}
		>
			<label>
				<span>New NPC type name</span>
				<input bind:value={newName} required />
			</label>
			<label>
				<span>Initiative stat (d6)</span>
				<input bind:value={newInitiativeStat} type="number" min="1" step="1" required />
			</label>
			<button type="submit">Save NPC type</button>
			<button
				class="quiet-button"
				type="button"
				onclick={() => {
					newName = '';
					newInitiativeStat = 1;
					isAdding = false;
				}}
			>
				Cancel
			</button>
		</form>
	{/if}
</section>
