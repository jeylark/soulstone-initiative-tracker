<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';
	import './ui-button.css';
	import './forms/form-controls.css';

	interface Props extends Omit<HTMLAnchorAttributes, 'children'> {
		/** Visual style, shared with ActionButton. Defaults to `primary`. */
		variant?: 'primary' | 'danger' | 'neutral';
		/** Disables the link: it loses its `href`, is skipped by keyboard focus, and ignores clicks. */
		isDisabled?: boolean;
		/** Extra CSS classes appended to the link. */
		class?: string;
		/** Link content. */
		children: Snippet;
		/** Whether the action is invalid; shows `invalidMessage` as an alert. */
		isInvalid?: boolean;
		/** Error text shown after the link. */
		invalidMessage?: string;
		/** Whether to display `warningMessage` as a status. */
		hasWarning?: boolean;
		/** Warning text shown after the link. */
		warningMessage?: string;
	}

	let {
		variant = 'primary',
		isDisabled = false,
		class: className = '',
		children,
		href,
		onclick,
		tabindex,
		isInvalid = false,
		invalidMessage,
		hasWarning = false,
		warningMessage,
		'aria-describedby': externalDescribedBy,
		...rest
	}: Props = $props();

	const messageId = $props.id();
	const invalidId = `${messageId}-invalid`;
	const warningId = `${messageId}-warning`;
	let describedBy = $derived(
		[
			...(externalDescribedBy ? [externalDescribedBy] : []),
			...(isInvalid && invalidMessage ? [invalidId] : []),
			...(hasWarning && warningMessage ? [warningId] : [])
		].join(' ') || undefined
	);
</script>

<a
	class={`ui-button ui-button--${variant} ${className}`}
	{...rest}
	// eslint-disable-next-line svelte/no-navigation-without-resolve -- callers pass an already resolved href
	href={isDisabled ? undefined : href}
	role={isDisabled ? 'link' : rest.role}
	tabindex={isDisabled ? -1 : tabindex}
	aria-describedby={describedBy}
	aria-disabled={isDisabled ? 'true' : rest['aria-disabled']}
	onclick={isDisabled ? (event) => event.preventDefault() : onclick}
>
	{@render children()}
</a>
{#if isInvalid && invalidMessage}
	<p id={invalidId} class="form-control-message form-control-message--invalid" role="alert">
		{invalidMessage}
	</p>
{/if}
{#if hasWarning && warningMessage}
	<p id={warningId} class="form-control-message form-control-message--warning" role="status">
		{warningMessage}
	</p>
{/if}
