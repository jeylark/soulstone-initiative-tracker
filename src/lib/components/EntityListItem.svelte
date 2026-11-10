<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLFieldsetAttributes } from 'svelte/elements';
	import ActionButton from './ActionButton.svelte';
	import Card from './Card.svelte';

	interface Props extends Omit<HTMLFieldsetAttributes, 'children'> {
		/** Visible card title and accessible name of the entity fieldset. */
		legend: string;
		/** Heading level of the card title. Defaults to h2. */
		headingLevel?: 'h2' | 'h3' | 'h4' | 'h5';
		/** Size of the card title. Defaults to large. */
		headerSize?: 'large' | 'medium' | 'small' | 'compact';
		/** Surface style of the card. Defaults to surface. */
		variant?: 'surface' | 'subtle' | 'inset';
		/** Padding of the card. Defaults to standard. */
		spacing?: 'standard' | 'compact';
		/** Accessible name of the remove button. */
		removeLabel: string;
		/** Tooltip text for the remove button. */
		removeText?: string;
		/** Disables the remove button without disabling the rest of the entity. */
		isRemoveDisabled?: boolean;
		/** Called when the remove button is clicked. */
		onRemove: () => void;
		/** Entity-specific content, rendered after the remove button. */
		children: Snippet;
	}

	let {
		legend,
		headingLevel,
		headerSize,
		variant,
		spacing,
		removeLabel,
		removeText = 'Remove',
		isRemoveDisabled = false,
		onRemove,
		children,
		...rest
	}: Props = $props();
</script>

<Card title={legend} {headingLevel} {headerSize} {variant} {spacing}>
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
</Card>

<style>
	:global(.card:has(> fieldset)) {
		position: relative;
	}

	:global(.card:has(> fieldset) > .card-header) {
		max-width: calc(100% - 48px);
		overflow-wrap: anywhere;
	}

	fieldset > :global(.entity-remove-button) {
		position: absolute;
		inset-block-start: 4px;
		inset-inline-end: 4px;
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
