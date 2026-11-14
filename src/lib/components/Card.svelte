<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		headingLevel?: 'h2' | 'h3' | 'h4' | 'h5';
		headerSize?: 'large' | 'medium' | 'small' | 'compact';
		variant?: 'surface' | 'subtle' | 'inset';
		spacing?: 'standard' | 'compact';
		/** Makes the card fill the height of its layout cell. */
		isFullHeight?: boolean;
		/** Reserves room for a control positioned over the card's top corner. */
		hasOverlayAction?: boolean;
		/** Shows the card's accent border and tinted surface. */
		isAccented?: boolean;
		/** CSS color used for the card accent border and surface tint. */
		accentColor?: string;
		/** Replaces an accent tint with the muted surface used for hidden items. */
		isMuted?: boolean;
		/** Sizes the card to its content while keeping it within its parent. */
		isContentSized?: boolean;
		/** Applies the standard width and shrink behavior for an EntityList strip item. */
		isStripItem?: boolean;
		class?: string;
		children: Snippet;
	}

	let {
		title,
		headingLevel = 'h2',
		headerSize = 'large',
		variant = 'surface',
		spacing = 'standard',
		isFullHeight = false,
		hasOverlayAction = false,
		isAccented = false,
		accentColor,
		isMuted = false,
		isContentSized = false,
		isStripItem = false,
		class: className = '',
		children
	}: Props = $props();
</script>

<div
	class={`card card--${variant} card--${spacing} ${isFullHeight ? 'card--full-height' : ''} ${hasOverlayAction ? 'card--overlay-action' : ''} ${isAccented ? 'card--accented' : ''} ${isMuted ? 'card--muted' : ''} ${isContentSized ? 'card--content-sized' : ''} ${isStripItem ? 'card--strip-item' : ''} ${className}`}
	style={accentColor ? `--card-accent-color: ${accentColor}` : undefined}
>
	<svelte:element this={headingLevel} class={`card-header card-header--${headerSize}`}>
		{title}
	</svelte:element>
	{@render children()}
</div>

<style>
	.card {
		--card-padding: 16px;

		width: 100%;
		min-width: 0;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		padding: var(--card-padding);
	}

	.card-header {
		width: fit-content;
		margin: calc(0px - var(--card-padding) - 0.6em + 1px) 0 12px calc(0px - var(--card-padding));
		padding: 0 8px;
		font-weight: 600;
		line-height: 1.2;
	}

	.card-header--large {
		font-size: 20px;
	}

	.card-header--medium {
		font-size: 17px;
	}

	.card-header--small {
		font-size: 15px;
	}

	.card-header--compact {
		font-size: 14px;
	}

	.card--surface {
		background: var(--color-surface);
	}

	.card--subtle {
		background: var(--color-surface-subtle);
	}

	.card--inset {
		background: var(--color-surface-inset);
	}

	.card--compact {
		--card-padding: 12px;
	}

	.card--full-height {
		box-sizing: border-box;
		height: 100%;
	}

	.card--overlay-action {
		position: relative;
	}

	.card--overlay-action > .card-header {
		max-width: calc(100% - 48px);
		overflow-wrap: anywhere;
	}

	.card--accented {
		border-inline-start: 6px solid var(--card-accent-color, var(--color-border));
		background: color-mix(
			in srgb,
			var(--card-accent-color, var(--color-surface)) 22%,
			var(--color-surface)
		);
	}

	.card--muted {
		background: color-mix(in srgb, #808080 18%, var(--color-surface));
	}

	.card--content-sized {
		width: auto;
		max-width: 100%;
	}

	.card--strip-item {
		flex: 0 1 min(280px, 100%);
		min-width: 0;
	}
</style>
