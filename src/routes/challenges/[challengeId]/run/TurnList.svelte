<script lang="ts">
	import type { StableId, TurnOrderDisplayItem } from '#lib/challenge';
	import Turn from './Turn.svelte';

	interface Props {
		items: readonly TurnOrderDisplayItem[];
		onVisibilityChange: (creatureId: StableId, isHidden: boolean) => void;
	}

	let { items, onVisibilityChange }: Props = $props();
</script>

<ol aria-label="Generated turn order" class="turn-order-list">
	{#each items as item (item.kind === 'turn' ? item.turnId : 'spawn')}
		<li>
			<Turn {item} {onVisibilityChange} />
		</li>
	{/each}
</ol>

<style>
	.turn-order-list {
		display: grid;
		gap: 12px;
		margin-block: 24px;
		padding: 0;
		list-style: none;
	}
</style>
