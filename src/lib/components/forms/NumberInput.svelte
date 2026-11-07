<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import './form-controls.css';

	interface Props extends Omit<HTMLInputAttributes, 'type'> {
		label: string;
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
	<label class="form-field">
		<span class:visually-hidden={isLabelVisuallyHidden}>{label}</span>
		<input
			{...rest}
			class={`form-control ${className}${hasWarning ? ' form-control--warning' : ''}${isInvalid ? ' form-control--invalid' : ''}`}
			aria-invalid={isInvalid ? 'true' : externalInvalid}
			aria-describedby={describedBy}
			type="number"
		/>
	</label>
	<div class="form-control-message-slot">
		{#if isInvalid && invalidMessage}
			<p id={invalidId} class="form-control-message form-control-message--invalid" role="alert">
				{invalidMessage}
			</p>
		{/if}
	</div>
	<div class="form-control-message-slot">
		{#if hasWarning && warningMessage}
			<p id={warningId} class="form-control-message form-control-message--warning" role="status">
				{warningMessage}
			</p>
		{/if}
	</div>
</div>
