<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLButtonAttributes, 'children'> {
		variant?: 'primary' | 'danger' | 'neutral';
		children: Snippet;
	}

	let {
		variant = 'primary',
		type = 'button',
		class: className = '',
		children,
		...rest
	}: Props = $props();
</script>

<button {type} class={`action-button action-button--${variant} ${className}`} {...rest}>
	{@render children()}
</button>

<style>
	.action-button {
		display: inline-flex;
		min-height: 40px;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 8px 14px;
		border: 1px solid transparent;
		border-radius: 4px;
		cursor: pointer;
		font: inherit;
	}

	.action-button:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-ring-offset);
	}

	.action-button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.action-button--primary {
		color: white;
		border-color: var(--color-accent);
		background: var(--color-accent);
	}

	.action-button--danger {
		color: var(--color-danger);
		background: var(--color-danger-surface);
	}

	.action-button--danger:hover:not(:disabled) {
		background: var(--color-danger-hover);
	}

	.action-button--neutral {
		padding-inline: 12px;
		border-color: var(--color-border);
		background: transparent;
		color: var(--color-foreground);
		font-size: 13px;
	}

	.action-button--neutral:hover:not(:disabled) {
		border-color: var(--color-accent);
	}
</style>
