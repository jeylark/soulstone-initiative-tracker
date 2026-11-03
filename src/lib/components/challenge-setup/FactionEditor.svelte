<script lang="ts">
	import type { Faction, StableId } from '#lib';

	interface Props {
		factions: readonly Faction[];
		usedFactionIds: ReadonlySet<StableId>;
		onCreate: (name: string) => void;
		onRename: (factionId: StableId, name: string) => void;
		onRemove: (factionId: StableId) => void;
	}

	let { factions, usedFactionIds, onCreate, onRename, onRemove }: Props = $props();
	let isAdding = $state(false);
	let newName = $state('');

	function submit() {
		const name = newName.trim();
		if (!name) return;

		onCreate(name);
		newName = '';
		isAdding = false;
	}
</script>

<section class="setup-section" aria-labelledby="factions-heading">
	<div class="section-heading">
		<h2 id="factions-heading">Factions</h2>
		<button type="button" onclick={() => (isAdding = true)}>Add faction</button>
	</div>
	{#if factions.length > 0}
		<ul class="entity-list">
			{#each factions as faction (faction.id)}
				<li>
					<label>
						<span>Faction name</span>
						<input
							aria-label={`Faction name: ${faction.name}`}
							value={faction.name}
							oninput={(event) => onRename(faction.id, event.currentTarget.value)}
						/>
					</label>
					<button
						class="quiet-button"
						type="button"
						disabled={usedFactionIds.has(faction.id)}
						aria-label={`Remove faction ${faction.name}`}
						title="Factions assigned to creatures cannot be removed"
						onclick={() => onRemove(faction.id)}
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
				<span>New faction name</span>
				<input bind:value={newName} required />
			</label>
			<button type="submit">Save faction</button>
			<button
				class="quiet-button"
				type="button"
				onclick={() => {
					newName = '';
					isAdding = false;
				}}
			>
				Cancel
			</button>
		</form>
	{/if}
</section>
