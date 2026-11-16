<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Visible title and accessible name of the scrollable content region. */
		title: string;
		/** Semantic heading level of the title; defaults to h2. */
		headingLevel?: 'h2' | 'h3' | 'h4' | 'h5';
		/** Title size; defaults to large. */
		headerSize?: 'large' | 'medium' | 'small' | 'compact';
		/** Surface treatment; defaults to surface. */
		variant?: 'surface' | 'subtle' | 'inset';
		/** Interior spacing; defaults to standard. */
		spacing?: 'standard' | 'compact';
		/** Fills the layout cell's height, capped at the unobstructed viewport height. */
		isFullHeight?: boolean;
		/** Reserves room for a control positioned over the card's top corner. */
		hasOverlayAction?: boolean;
		/** Space above the scrollable body in pixels; defaults to zero and clamps negative values to zero. */
		scrollbarInsetTop?: number;
		/** Space below the scrollable body in pixels; defaults to zero and clamps negative values to zero. */
		scrollbarInsetBottom?: number;
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
		/** Additional caller-owned classes for the outer card. */
		class?: string;
		/** Card contents; scroll independently of the visible title when height is constrained. */
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
		scrollbarInsetTop = 0,
		scrollbarInsetBottom = 0,
		isAccented = false,
		accentColor,
		isMuted = false,
		isContentSized = false,
		isStripItem = false,
		class: className = '',
		children
	}: Props = $props();
	const titleId = $props.id();
</script>

<div
	class={`card card--${variant} card--${spacing} ${isFullHeight ? 'card--full-height' : ''} ${hasOverlayAction ? 'card--overlay-action' : ''} ${isAccented ? 'card--accented' : ''} ${isMuted ? 'card--muted' : ''} ${isContentSized ? 'card--content-sized' : ''} ${isStripItem ? 'card--strip-item' : ''} ${className}`}
	style={accentColor ? `--card-accent-color: ${accentColor}` : undefined}
>
	<svelte:element this={headingLevel} id={titleId} class={`card-header card-header--${headerSize}`}>
		{title}
	</svelte:element>
	<div
		class="card-body"
		role="region"
		aria-labelledby={titleId}
		tabindex="0"
		style:--card-scrollbar-inset-top={`${Math.max(0, scrollbarInsetTop)}px`}
		style:--card-scrollbar-inset-bottom={`${Math.max(0, scrollbarInsetBottom)}px`}
	>
		{@render children()}
	</div>
</div>

<style>
	.card {
		--card-padding: 16px;
		--card-viewport-height: 100vh;

		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		width: 100%;
		min-width: 0;
		min-block-size: 0;
		max-block-size: max(
			0px,
			calc(
				var(--card-viewport-height) - var(--app-sticky-header-height, 0px) -
					var(--app-sticky-footer-height, 0px) - 12px
			)
		);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		padding: var(--card-padding);
	}

	.card-header {
		flex-shrink: 0;
		width: fit-content;
		max-width: 100%;
		overflow-wrap: anywhere;
		margin: calc(0px - var(--card-padding) - 0.6em + 1px) 0 12px calc(0px - var(--card-padding));
		padding: 0 8px;
		font-weight: 600;
		line-height: 1.2;
	}

	.card-body {
		flex: 0 1 auto;
		min-width: 0;
		min-block-size: 0;
		overflow: auto;
		margin: -12px;
		margin-block-start: calc(-12px + var(--card-scrollbar-inset-top));
		margin-block-end: calc(-12px + var(--card-scrollbar-inset-bottom));
		padding: 12px;
	}

	.card-body:focus-visible {
		outline: var(--focus-ring);
		outline-offset: -2px;
	}

	@supports (height: 100dvh) {
		.card {
			--card-viewport-height: 100dvh;
		}
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

	.card--full-height > .card-body {
		flex-grow: 1;
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
