<script lang="ts">
	import type { StableId, TurnOrderDisplayItem, ViewerTurnOrderDisplayItem } from '#lib/challenge';
	import TurnOrderItem from './TurnOrderItem.svelte';

	interface Props {
		/** Ordered turn and Spawn entries to display. Filtering remains the caller's responsibility. */
		items: readonly (TurnOrderDisplayItem | ViewerTurnOrderDisplayItem)[];
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

	.turn-order-list > :first-child {
		width: 100%;
	}

	.turn-order-list > :not(:first-child) {
		width: 75%;
		justify-self: center;
	}
</style>
