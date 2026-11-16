<script lang="ts">
	import './form-controls.css';
	import type { Snippet } from 'svelte';

	interface Props {
		/** Caller-owned layout class; configure the grid with --form-group-min-column-width, --form-group-column-gap and --form-group-row-gap. */
		class?: string;
		/** Custom form controls rendered as direct children and sharing the group's alignment rows. */
		children: Snippet;
	}

	let { class: className = '', children }: Props = $props();
</script>

<div class={`form-group ${className}`}>
	{@render children()}
</div>
