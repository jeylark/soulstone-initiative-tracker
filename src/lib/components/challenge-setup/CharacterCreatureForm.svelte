<script lang="ts">
	import type { Faction, StableId } from '#lib';

	interface Props {
		factions: readonly Faction[];
		factionId: StableId | '';
		onFactionChange: (factionId: StableId) => void;
		onCreate: (name: string) => void;
	}

	let { factions, factionId, onFactionChange, onCreate }: Props = $props();
	let name = $state('');

	function submit() {
		const normalizedName = name.trim();
		if (!normalizedName || !factionId) return;

		onCreate(normalizedName);
		name = '';
	}
</script>

<form
	class="inline-form"
	onsubmit={(event) => {
		event.preventDefault();
		submit();
	}}
>
	<h3>Player character</h3>
	<label>
		<span>Character name</span>
		<input bind:value={name} autocomplete="off" required />
	</label>
	<label>
		<span>Character faction</span>
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
	<button type="submit" disabled={!factions.length}>Add character</button>
</form>
