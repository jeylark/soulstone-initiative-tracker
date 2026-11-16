<script lang="ts">
	import './form-controls.css';
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	const inputId = $props.id();
	const labelId = `${inputId}-label`;
	const warningId = `${inputId}-warning`;
	const invalidId = `${inputId}-invalid`;

	interface Props extends Omit<
		HTMLInputAttributes,
		'type' | 'id' | 'value' | 'min' | 'max' | 'step' | 'class' | 'oninput'
	> {
		/** Visible label shared by the slider and number field. */
		label: string;
		/** Whether the shared label is visually hidden while remaining accessible. */
		isLabelVisuallyHidden?: boolean;
		/** Optional id assigned to the slider. */
		id?: string;
		/** Optional id assigned to the number field. */
		numberId?: string;
		/** Current value shown in the number field and clamped to the slider bounds. */
		value: number;
		/** Minimum value allowed by the slider. */
		min: number;
		/** Maximum value allowed by the slider. */
		max: number;
		/** Slider increment. */
		step: number;
		/** Optional minimum value allowed by the number field. */
		numberMin?: number;
		/** Optional maximum value allowed by the number field. */
		numberMax?: number;
		/** Increment or `any` value allowed by the number field. */
		numberStep?: number | 'any';
		/** Whether to display the warning message. */
		hasWarning?: boolean;
		/** Warning text shared by both controls. */
		warningMessage?: string;
		/** Whether the value is invalid. */
		isInvalid?: boolean;
		/** Error text shared by both controls. */
		invalidMessage?: string;
		/** Optional supporting content displayed below the controls and messages. */
		description?: Snippet;
		/** Optional class assigned to the slider. */
		class?: string;
		/** Optional class assigned to the number field. */
		numberClass?: string;
		/** Handler called when the slider value changes. */
		onSliderInput?: NonNullable<HTMLInputAttributes['oninput']>;
		/** Handler called when the number field changes. */
		onNumberInput?: NonNullable<HTMLInputAttributes['oninput']>;
	}

	let {
		label,
		isLabelVisuallyHidden = false,
		id = `${inputId}-slider`,
		numberId = `${inputId}-number`,
		value,
		min,
		max,
		step,
		numberMin,
		numberMax,
		numberStep,
		hasWarning = false,
		warningMessage,
		isInvalid = false,
		invalidMessage,
		description,
		'aria-describedby': externalDescribedBy,
		'aria-invalid': externalInvalid,
		class: sliderClass = '',
		numberClass = '',
		onSliderInput,
		onNumberInput,
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
	<span id={labelId} class="form-control-label" class:visually-hidden={isLabelVisuallyHidden}
		>{label}</span
	>
	<fieldset class="form-range-field" aria-labelledby={labelId}>
		<div class="form-range-input">
			<label class="form-field">
				<span class="visually-hidden">{label} slider</span>
				<input
					{...rest}
					{id}
					class={`form-control ${sliderClass}${hasWarning ? ' form-control--warning' : ''}${isInvalid ? ' form-control--invalid' : ''}`}
					aria-invalid={isInvalid ? 'true' : externalInvalid}
					aria-describedby={describedBy}
					{min}
					{max}
					{step}
					value={Math.min(Math.max(value, min), max)}
					oninput={onSliderInput}
					type="range"
				/>
			</label>
			<label class="form-field">
				<span class="visually-hidden">{label} value</span>
				<input
					{...rest}
					id={numberId}
					class={`form-control ${numberClass}${hasWarning ? ' form-control--warning' : ''}${isInvalid ? ' form-control--invalid' : ''}`}
					aria-invalid={isInvalid ? 'true' : externalInvalid}
					aria-describedby={describedBy}
					min={numberMin}
					max={numberMax}
					step={numberStep}
					{value}
					oninput={onNumberInput}
					type="number"
				/>
			</label>
		</div>
	</fieldset>
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
		{#if description}{@render description()}{/if}
	</div>
</div>
