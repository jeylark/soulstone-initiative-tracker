<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { measureButtonGroup } from './button-group-measurement';

	interface Props {
		/** Button group items to display. */
		children: Snippet;
		/** Direction in which buttons are arranged. */
		orientation?: 'horizontal' | 'vertical';
		/** Whether the group fills the available width. */
		isFullWidth?: boolean;
		/** Caller-owned class for the group container. */
		class?: string;
	}

	let {
		children,
		orientation = 'horizontal',
		isFullWidth = false,
		class: className = ''
	}: Props = $props();

	let group: HTMLDivElement;
	let measurementHost: HTMLDivElement;
	let measurement = $state.raw<ReturnType<typeof measureButtonGroup>>();

	onMount(() => {
		measurement = measureButtonGroup(
			() => group,
			() => measurementHost,
			() => orientation
		);
		return () => measurement?.stop();
	});

	$effect(() => {
		void [orientation, isFullWidth];
		measurement?.measure();
	});
</script>

<div
	bind:this={group}
	class={`button-group button-group--${orientation} ${isFullWidth ? 'button-group--full-width' : ''} ${className}`}
>
	{@render children()}
	<div class="button-group-measurement" aria-hidden="true" inert bind:this={measurementHost}></div>
</div>

<style>
	.button-group {
		position: relative;
		display: inline-grid;
		grid-template-columns: repeat(var(--button-group-columns, 1), minmax(0, 1fr));
		gap: 8px;
		width: var(--button-group-target-width, max-content);
		max-width: 100%;
		min-width: 0;
	}

	.button-group--full-width {
		width: 100%;
	}

	.button-group-measurement {
		position: absolute;
		visibility: hidden;
		pointer-events: none;
		inline-size: max-content;
	}
</style>
