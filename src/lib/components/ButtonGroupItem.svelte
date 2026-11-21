<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** One NavButton or ActionButton, including its feedback. */
		children: Snippet;
		/** Additional text labels to reserve space for throughout the group's lifetime. */
		sizingLabels?: readonly string[];
	}

	let { children, sizingLabels = [] }: Props = $props();
</script>

<div class="button-group-item" data-sizing-labels={JSON.stringify(sizingLabels)}>
	{@render children()}
</div>

<style>
	.button-group-item {
		min-width: 0;
		align-self: start;
	}
</style>
