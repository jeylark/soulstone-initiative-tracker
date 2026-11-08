<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import './form-controls.css';

	interface Props extends Omit<HTMLInputAttributes, 'type'> {
		label: string;
		isLabelVisuallyHidden?: boolean;
		/** Whether to display the warning message. */
		hasWarning?: boolean;
		/** Warning text shown below the checkbox. */
		warningMessage?: string;
		isInvalid?: boolean;
		invalidMessage?: string;
	}

	const inputId = $props.id();
	const invalidId = `${inputId}-invalid`;
	const warningId = `${inputId}-warning`;

	let {
		label,
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

<div class="form-field-messages">
	<label class="form-field form-checkbox-field" class:is-invalid={isInvalid}>
		<input
			{...rest}
			class={`form-checkbox-control ${className}`}
			aria-invalid={isInvalid ? 'true' : externalInvalid}
			aria-describedby={describedBy}
			type="checkbox"
		/>
		<span class:visually-hidden={isLabelVisuallyHidden}>{label}</span>
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
