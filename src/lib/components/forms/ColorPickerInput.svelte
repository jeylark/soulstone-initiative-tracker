<script lang="ts" generics="T extends string">
	import './form-controls.css';

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
		/** Disables every color option. */
		readonly isDisabled?: boolean;
		/** Whether to display the warning message. */
		readonly hasWarning?: boolean;
		/** Warning text shown below the picker. */
		readonly warningMessage?: string;
		/** Whether the selection is invalid. */
		readonly isInvalid?: boolean;
		/** Error text shown below the picker. */
		readonly invalidMessage?: string;
		/** Called with the selected option's value. */
		readonly onchange: (value: T) => void;
	}

	const pickerId = $props.id();
	const warningId = `${pickerId}-warning`;
	const invalidId = `${pickerId}-invalid`;

	let {
		label,
		name,
		options,
		value,
		isDisabled = false,
		hasWarning = false,
		warningMessage,
		isInvalid = false,
		invalidMessage,
		onchange
	}: Props<T> = $props();

	let describedBy = $derived(
		[
			...(isInvalid && invalidMessage ? [invalidId] : []),
			...(hasWarning && warningMessage ? [warningId] : [])
		].join(' ') || undefined
	);
</script>

<div class="form-field-messages">
	<fieldset class="form-color-picker" disabled={isDisabled} aria-describedby={describedBy}>
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
