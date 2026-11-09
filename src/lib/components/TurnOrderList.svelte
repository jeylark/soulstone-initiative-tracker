<script lang="ts">
	import type { StableId, TurnOrderDisplayItem } from '#lib/challenge';
	import TurnOrderItem from './TurnOrderItem.svelte';

	interface Props {
		/** Ordered turn and Spawn entries to display. Filtering remains the caller's responsibility. */
		items: readonly TurnOrderDisplayItem[];
		/** Optional handler for changing a creature's visibility; omitted for read-only lists. */
		onVisibilityChange?: (creatureId: StableId, isHidden: boolean) => void;
	}

	let { items, onVisibilityChange }: Props = $props();
</script>

<ol aria-label="Generated turn order" class="turn-order-list">
	{#each items as item, index (item.kind === 'turn' ? item.turnId : 'spawn')}
		<li aria-current={index === 0 ? 'step' : undefined}>
			<TurnOrderItem {item} {onVisibilityChange} />
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
