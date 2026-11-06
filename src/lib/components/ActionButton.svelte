<script lang="ts">
	import './ui-button.css';
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

<button {type} class={`ui-button ui-button--${variant} ${className}`} {...rest}>
	{@render children()}
</button>
