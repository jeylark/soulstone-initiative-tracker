<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLFieldsetAttributes } from 'svelte/elements';
	import ActionButton from './ActionButton.svelte';

	interface Props extends Omit<HTMLFieldsetAttributes, 'children'> {
		/** Visible name of the entity, used as the fieldset legend. */
		legend: string;
		/** Accessible name of the remove button. */
		removeLabel: string;
		/** Tooltip text for the remove button. */
		removeText?: string;
		/** Disables the remove button without disabling the rest of the entity. */
		isRemoveDisabled?: boolean;
		/** Called when the remove button is clicked. */
		onRemove: () => void;
		/** Entity-specific content, rendered before the remove button. */
		children: Snippet;
	}

	let {
		legend,
		removeLabel,
		removeText = 'Remove',
		isRemoveDisabled = false,
		onRemove,
		children,
		...rest
	}: Props = $props();
</script>

<fieldset {...rest}>
	<legend>{legend}</legend>
	<ActionButton
		variant="danger"
		class="entity-remove-button"
		aria-label={removeLabel}
		title={removeText}
		disabled={isRemoveDisabled}
		onclick={onRemove}
	>
		<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
			<path
				d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-6 4v8m4-8v8"
			/>
		</svg>
	</ActionButton>
	{@render children()}
</fieldset>

<style>
	fieldset > :global(.entity-remove-button) {
		grid-column: 1 / -1;
		align-self: start;
		justify-self: end;
		margin-inline-start: auto;
		min-width: 32px;
		min-height: 32px;
		padding: 6px;
	}

	:global(.entity-remove-button svg) {
		width: 16px;
		height: 16px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}
</style>
