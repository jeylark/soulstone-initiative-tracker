<script lang="ts">
	import type { NpcType, StableId } from '#lib';

	interface Props {
		factionName: string;
		npcTypes: readonly NpcType[];
		npcTypeId: StableId | '';
		onNpcTypeChange: (npcTypeId: StableId) => void;
		onCreate: (identifier: string) => void;
		onCancel: () => void;
	}

	let { factionName, npcTypes, npcTypeId, onNpcTypeChange, onCreate, onCancel }: Props = $props();
	let identifier = $state('');

	function submit() {
		const normalizedIdentifier = identifier.trim();
		if (!normalizedIdentifier || !npcTypeId) return;

		onCreate(normalizedIdentifier);
		identifier = '';
	}
</script>

<form
	class="inline-form faction-entry-form"
	onsubmit={(event) => {
		event.preventDefault();
		submit();
	}}
>
	<h3>NPC</h3>
	<label>
		<span>NPC type</span>
		<select
			value={npcTypeId}
			required
			disabled={!npcTypes.length}
			onchange={(event) => onNpcTypeChange(event.currentTarget.value as StableId)}
		>
			<option value="" disabled>Select an NPC type</option>
			{#each npcTypes as npcType (npcType.id)}
				<option value={npcType.id}>{npcType.name}</option>
			{/each}
		</select>
	</label>
	<label>
		<span>NPC identifier</span>
		<input
			aria-label={`NPC identifier for ${factionName}`}
			bind:value={identifier}
			autocomplete="off"
			required
		/>
	</label>
	<button type="submit" disabled={!npcTypeId}>Save NPC</button>
	<button class="quiet-button" type="button" onclick={onCancel}>Cancel</button>
</form>
