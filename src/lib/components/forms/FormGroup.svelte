<script lang="ts">
	import './form-controls.css';
	import type { Snippet } from 'svelte';

	interface Props {
		/** Caller-owned class for column sizing and responsive layout; row gaps use --form-group-row-gap. */
		class?: string;
		/** Custom form controls rendered as direct children and sharing the group's alignment rows. */
		children: Snippet;
	}

	let { class: className = '', children }: Props = $props();
</script>

<div class={`form-group ${className}`}>
	{@render children()}
</div>
