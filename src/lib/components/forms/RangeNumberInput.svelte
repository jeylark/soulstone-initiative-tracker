<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import NumberInput from './NumberInput.svelte';
	import RangeInput from './RangeInput.svelte';

	interface Props {
		/** Accessible name for the slider. */
		sliderLabel: string;
		/** Accessible name for the number field. */
		numberLabel: string;
		/** Whether both labels are visually hidden while remaining accessible. */
		isLabelVisuallyHidden?: boolean;
		/** Optional id assigned to the slider. */
		sliderId?: string;
		/** Optional class assigned to the number field. */
		numberClass?: string;
		/** Current value displayed by the number field and clamped for the slider. */
		value: number;
		/** Minimum value allowed by the slider. */
		min: number;
		/** Maximum value allowed by the slider. */
		max: number;
		/** Slider increment. */
		step: number;
		/** Optional minimum value allowed by the number field. */
		numberMin?: number;
		/** Increment or `any` value allowed by the number field. */
		numberStep?: number | 'any';
		/** Handler called when the slider value changes. */
		onSliderInput: NonNullable<HTMLInputAttributes['oninput']>;
		/** Handler called when the number field changes. */
		onNumberInput: NonNullable<HTMLInputAttributes['oninput']>;
	}

	let {
		sliderLabel,
		numberLabel,
		isLabelVisuallyHidden = false,
		sliderId,
		numberClass = '',
		value,
		min,
		max,
		step,
		numberMin,
		numberStep,
		onSliderInput,
		onNumberInput
	}: Props = $props();
</script>

<div class="range-number-input">
	<RangeInput
		label={sliderLabel}
		{isLabelVisuallyHidden}
		id={sliderId}
		{min}
		{max}
		{step}
		value={Math.min(Math.max(value, min), max)}
		oninput={onSliderInput}
	/>
	<NumberInput
		label={numberLabel}
		{isLabelVisuallyHidden}
		class={numberClass}
		{value}
		min={numberMin}
		step={numberStep}
		oninput={onNumberInput}
	/>
</div>

<style>
	.range-number-input {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(8ch, 12ch);
		align-items: center;
		gap: 12px;
	}
</style>
