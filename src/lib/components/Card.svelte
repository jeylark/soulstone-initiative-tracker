<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		headingLevel?: 'h2' | 'h3' | 'h4' | 'h5';
		headerSize?: 'large' | 'medium' | 'small' | 'compact';
		variant?: 'surface' | 'subtle' | 'inset';
		spacing?: 'standard' | 'compact';
		class?: string;
		children: Snippet;
	}

	let {
		title,
		headingLevel = 'h2',
		headerSize = 'large',
		variant = 'surface',
		spacing = 'standard',
		class: className = '',
		children
	}: Props = $props();
</script>

<div class={`card card--${variant} card--${spacing} ${className}`}>
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

	:global(.card > fieldset > legend) {
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
</style>
