<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import './ui-button.css';

	interface Props extends Omit<HTMLAnchorAttributes, 'children'> {
		/** Visual style, shared with ActionButton. Defaults to `primary`. */
		variant?: 'primary' | 'danger' | 'neutral';
		/** Disables the link: it loses its `href`, is skipped by keyboard focus, and ignores clicks. */
		isDisabled?: boolean;
		/** Extra CSS classes appended to the link. */
		class?: string;
		/** Link content. */
		children: Snippet;
	}

	let {
		variant = 'primary',
		isDisabled = false,
		class: className = '',
		children,
		href,
		onclick,
		tabindex,
		...rest
	}: Props = $props();
</script>

<a
	class={`ui-button ui-button--${variant} ${className}`}
	{...rest}
	// eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass an already resolved href
	href={isDisabled ? undefined : href}
	role={isDisabled ? 'link' : rest.role}
	tabindex={isDisabled ? -1 : tabindex}
	aria-disabled={isDisabled ? 'true' : rest['aria-disabled']}
	onclick={isDisabled ? (event) => event.preventDefault() : onclick}
>
	{@render children()}
</a>
