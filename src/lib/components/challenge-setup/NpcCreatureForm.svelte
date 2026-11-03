<script lang="ts">
	import type { Faction, NpcType, StableId } from '#lib';

	interface Props {
		factions: readonly Faction[];
		npcTypes: readonly NpcType[];
		factionId: StableId | '';
		npcTypeId: StableId | '';
		onFactionChange: (factionId: StableId) => void;
		onNpcTypeChange: (npcTypeId: StableId) => void;
		onCreate: (identifier: string) => void;
	}

	let {
		factions,
		npcTypes,
		factionId,
		npcTypeId,
		onFactionChange,
		onNpcTypeChange,
		onCreate
	}: Props = $props();
	let identifier = $state('');

	function submit() {
		const normalizedIdentifier = identifier.trim();
		if (!normalizedIdentifier || !factionId || !npcTypeId) return;

		onCreate(normalizedIdentifier);
		identifier = '';
	}
</script>

<form
	class="inline-form"
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
		<input bind:value={identifier} autocomplete="off" required />
	</label>
	<label>
		<span>NPC faction</span>
		<select
			value={factionId}
			required
			disabled={!factions.length}
			onchange={(event) => onFactionChange(event.currentTarget.value as StableId)}
		>
			<option value="" disabled>Select a faction</option>
			{#each factions as faction (faction.id)}
				<option value={faction.id}>{faction.name}</option>
			{/each}
		</select>
	</label>
	<button type="submit" disabled={!factionId || !npcTypes.length}>Add NPC</button>
</form>
