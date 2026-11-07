<script lang="ts" generics="T extends string">
	/** A color choice rendered as a labeled radio option and swatch. */
	interface ColorPickerOption<T extends string> {
		/** Value emitted when this color is selected. */
		readonly value: T;
		/** Accessible and visible name for this color. */
		readonly label: string;
		/** CSS color value used to render the swatch. */
		readonly hex: string;
	}

	/** Public properties for the reusable color picker. */
	interface Props<T extends string> {
		/** Accessible group label describing what is being colored. */
		readonly label: string;
		/** Radio-group name that keeps this picker independent of other pickers. */
		readonly name: string;
		/** Available colors, each with a value, visible label, and CSS color. */
		readonly options: readonly ColorPickerOption<T>[];
		/** Currently selected color value. */
		readonly value: T;
		/** Called with the selected option's value. */
		readonly onchange: (value: T) => void;
	}

	let { label, name, options, value, onchange }: Props<T> = $props();
</script>

<fieldset class="form-color-picker">
	<legend class="form-color-picker__legend">{label}</legend>
	<div class="form-color-picker__options">
		{#each options as option (option.value)}
			<label class="form-color-picker__option" style={`--picker-color: ${option.hex}`}>
				<input
					type="radio"
					{name}
					value={option.value}
					checked={value === option.value}
					onchange={() => onchange(option.value)}
				/>
				<span class="form-color-picker__swatch" aria-hidden="true"></span>
				<span>{option.label}</span>
			</label>
		{/each}
	</div>
</fieldset>
