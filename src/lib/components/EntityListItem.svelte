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
		/** Applies the standard width and shrink behavior when used in an EntityList strip. */
		isStripItem?: boolean;
		/** Accessible name of the remove button. */
		removeLabel?: string;
		/** Tooltip text for the remove button. */
		removeText?: string;
		/** Disables the remove button without disabling the rest of the entity. */
		isRemoveDisabled?: boolean;
		/** Called when the remove button is clicked. */
		onRemove?: () => void;
		/** Entity-specific content, rendered after the remove button. */
		children: Snippet;
	}

	let {
		legend,
		headingLevel,
		headerSize,
		variant,
		spacing,
		isStripItem = false,
		removeLabel,
		removeText = 'Remove',
		isRemoveDisabled = false,
		onRemove,
		children,
		...rest
	}: Props = $props();
</script>

<Card title={legend} {headingLevel} {headerSize} {variant} {spacing} hasOverlayAction {isStripItem}>
	<fieldset {...rest}>
		<legend class="entity-list-item-legend">{legend}</legend>
		{#if removeLabel && onRemove}
			<div class="entity-remove-action">
				<ActionButton
					variant="danger"
					isOverlayAction
					aria-label={removeLabel}
					title={removeText}
					disabled={isRemoveDisabled}
					onclick={onRemove}
				>
					<svg class="entity-remove-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
						<path
							d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-6 4v8m4-8v8"
						/>
					</svg>
				</ActionButton>
			</div>
		{/if}
		{@render children()}
	</fieldset>
</Card>

<style>
	.entity-list-item-legend {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}

	.entity-remove-action {
		min-height: 32px;
	}

	.entity-remove-icon {
		width: 16px;
		height: 16px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}
</style>
