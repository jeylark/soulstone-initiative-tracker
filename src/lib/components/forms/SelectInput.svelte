<script lang="ts">
	import './form-controls.css';
	import type { Snippet } from 'svelte';
	import type { HTMLSelectAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLSelectAttributes, 'children'> {
		/** Option content rendered inside the select. */
		children: Snippet;
		/** Visible label text. */
		label: string;
		/** Whether the label is visually hidden while remaining accessible. */
		isLabelVisuallyHidden?: boolean;
		/** Whether to display the warning message. */
		hasWarning?: boolean;
		/** Warning text shown below the select. */
		warningMessage?: string;
		/** Whether the value is invalid. */
		isInvalid?: boolean;
		/** Error text shown below the select. */
		invalidMessage?: string;
	}

	const inputId = $props.id();
	const warningId = `${inputId}-warning`;
	const invalidId = `${inputId}-invalid`;

	let {
		class: className = '',
		children,
		label,
		isLabelVisuallyHidden = false,
		hasWarning = false,
		warningMessage,
		isInvalid = false,
		invalidMessage,
		'aria-describedby': externalDescribedBy,
		'aria-invalid': externalInvalid,
		...rest
	}: Props = $props();

	let describedBy = $derived(
		[
			...(externalDescribedBy ? [externalDescribedBy] : []),
			...(isInvalid && invalidMessage ? [invalidId] : []),
			...(hasWarning && warningMessage ? [warningId] : [])
		].join(' ') || undefined
	);
</script>

<div class="form-field-messages">
	<label class="form-field">
		<span class:visually-hidden={isLabelVisuallyHidden}>{label}</span>
		<select
			{...rest}
			class={`form-control ${className}${hasWarning ? ' form-control--warning' : ''}${isInvalid ? ' form-control--invalid' : ''}`}
			aria-invalid={isInvalid ? 'true' : externalInvalid}
			aria-describedby={describedBy}
		>
			{@render children()}
		</select>
	</label>
	<div class="form-control-message-area">
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
	</div>
</div>
