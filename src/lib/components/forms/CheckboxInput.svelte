<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import './form-controls.css';

	interface Props extends Omit<HTMLInputAttributes, 'type'> {
		label: string;
		isLabelVisuallyHidden?: boolean;
		isInvalid?: boolean;
		invalidMessage?: string;
	}

	const inputId = $props.id();
	const invalidId = `${inputId}-invalid`;

	let {
		label,
		isLabelVisuallyHidden = false,
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
			...(isInvalid && invalidMessage ? [invalidId] : [])
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
	<div class="form-control-message-slot">
		{#if isInvalid && invalidMessage}
			<p id={invalidId} class="form-control-message form-control-message--invalid" role="alert">
				{invalidMessage}
			</p>
		{/if}
	</div>
</div>
