<script lang="ts">
	import './ui-button.css';
	import './forms/form-controls.css';
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLButtonAttributes, 'children'> {
		variant?: 'primary' | 'danger' | 'neutral';
		/** Positions the button over the top corner of a containing card. */
		isOverlayAction?: boolean;
		children: Snippet;
		/** Whether the action is invalid; shows `invalidMessage` as an alert. */
		isInvalid?: boolean;
		/** Error text shown after the button. */
		invalidMessage?: string;
		/** Whether to display `warningMessage` as a status. */
		hasWarning?: boolean;
		/** Warning text shown after the button. */
		warningMessage?: string;
	}

	let {
		variant = 'primary',
		isOverlayAction = false,
		type = 'button',
		class: className = '',
		isInvalid = false,
		invalidMessage,
		hasWarning = false,
		warningMessage,
		'aria-describedby': externalDescribedBy,
		children,
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

<button
	{type}
	class={`ui-button ui-button--${variant} ${isOverlayAction ? 'ui-button--overlay-action' : ''} ${className}`}
	{...rest}
	aria-describedby={describedBy}
>
	{@render children()}
</button>
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

<style>
	.ui-button--overlay-action {
		position: absolute;
		inset-block-start: 0;
		inset-inline-end: 0;
		min-width: 32px;
		min-height: 32px;
		padding: 6px;
	}
</style>
