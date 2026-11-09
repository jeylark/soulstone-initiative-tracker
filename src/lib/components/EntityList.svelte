<script lang="ts">
	import type { Snippet } from 'svelte';
	import ActionButton from './ActionButton.svelte';

	interface Props {
		/** Text of the single add button. */
		addLabel?: string;
		/** Accessible name of the add button when `addLabel` is not specific enough. */
		addAriaLabel?: string;
		/** Disables the add button. */
		isAddDisabled?: boolean;
		/** Called when the add button is clicked. */
		onAdd?: () => void;
		/** Replaces the single add button, for lists with several kinds of entity. */
		actions?: Snippet;
		/** How the items are arranged: vertical stack, wrapping strip, or responsive grid. */
		layout?: 'grid' | 'strip' | 'stack';
		/** The list items, typically `EntityListItem`s or cards. */
		children: Snippet;
	}

	let {
		addLabel,
		addAriaLabel,
		isAddDisabled = false,
		onAdd,
		actions,
		layout = 'stack',
		children
	}: Props = $props();
</script>

<div class="entity-list">
	<div class={`entity-list-items entity-list-items--${layout}`}>
		{@render children()}
	</div>
	<div class="entity-list-actions">
		{#if actions}
			{@render actions()}
		{:else}
			<ActionButton aria-label={addAriaLabel} disabled={isAddDisabled} onclick={onAdd}>
				{addLabel}
			</ActionButton>
		{/if}
	</div>
</div>

<style>
	.entity-list {
		display: grid;
		gap: 12px;
		min-width: 0;
	}

	.entity-list-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.entity-list-items:empty {
		display: none;
	}

	.entity-list-items--stack {
		display: grid;
		gap: 12px;
	}

	.entity-list-items--strip {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}

	.entity-list-items--strip > :global(*) {
		flex: 0 1 min(280px, 100%);
		min-width: 0;
	}

	.entity-list-items--grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
		align-items: start;
		gap: 20px;
	}

	@media (max-width: 640px) {
		.entity-list-items--grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
