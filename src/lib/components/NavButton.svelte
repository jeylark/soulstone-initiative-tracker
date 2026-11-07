<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import './ui-button.css';

	interface Props extends Omit<HTMLAnchorAttributes, 'children'> {
		/** Visual style, shared with ActionButton. Defaults to `primary`. */
		variant?: 'primary' | 'danger' | 'neutral';
		/** Extra CSS classes appended to the link. */
		class?: string;
		/** Link content. */
		children: Snippet;
	}

	let { variant = 'primary', class: className = '', children, ...rest }: Props = $props();
</script>

<a class={`ui-button ui-button--${variant} ${className}`} {...rest}>
	{@render children()}
</a>
