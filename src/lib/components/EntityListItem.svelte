<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLFieldsetAttributes } from 'svelte/elements';
	import ActionButton from './ActionButton.svelte';

	interface Props extends Omit<HTMLFieldsetAttributes, 'children'> {
		/** Visible name of the entity, used as the fieldset legend. */
		legend: string;
		/** Accessible name of the remove button. */
		removeLabel: string;
		/** Text of the remove button. */
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
		disabled={isRemoveDisabled}
		onclick={onRemove}
	>
		{removeText}
	</ActionButton>
	{@render children()}
</fieldset>

<style>
	fieldset > :global(.entity-remove-button) {
		grid-column: 1 / -1;
		align-self: start;
		justify-self: start;
	}
</style>
