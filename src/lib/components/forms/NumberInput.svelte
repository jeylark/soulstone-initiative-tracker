<script lang="ts">
	import './form-controls.css';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'type'> {
		label: string;
		/** Caller-owned class applied to the label text. */
		labelClass?: string;
		isLabelVisuallyHidden?: boolean;
		hasWarning?: boolean;
		warningMessage?: string;
		isInvalid?: boolean;
		invalidMessage?: string;
	}

	const inputId = $props.id();
	const warningId = `${inputId}-warning`;
	const invalidId = `${inputId}-invalid`;

	let {
		label,
		labelClass = '',
		isLabelVisuallyHidden = false,
		hasWarning = false,
		warningMessage,
		isInvalid = false,
		invalidMessage,
		'aria-describedby': externalDescribedBy,
		'aria-invalid': externalInvalid,
		class: className = '',
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

<div class="form-field-messages form-field-messages--align-labels">
	<label class="form-field">
		<span class:visually-hidden={isLabelVisuallyHidden} class={`form-control-label ${labelClass}`}
			>{label}</span
		>
		<input
			{...rest}
			class={`form-control ${className}${hasWarning ? ' form-control--warning' : ''}${isInvalid ? ' form-control--invalid' : ''}`}
			aria-invalid={isInvalid ? 'true' : externalInvalid}
			aria-describedby={describedBy}
			type="number"
		/>
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
