<script lang="ts">
	import FormGroup from './FormGroup.svelte';
	import TextInput from './TextInput.svelte';
	import NumberInput from './NumberInput.svelte';
	import SelectInput from './SelectInput.svelte';
	import RangeInput from './RangeInput.svelte';
	import CheckboxInput from './CheckboxInput.svelte';
	import ColorPickerInput from './ColorPickerInput.svelte';

	let { isInvalid = false, hasWarning = false }: { isInvalid?: boolean; hasWarning?: boolean } =
		$props();
</script>

<FormGroup class="fixture-columns">
	<TextInput
		label="A long text label that can wrap"
		{isInvalid}
		invalidMessage="A long validation message that can wrap."
		{hasWarning}
		warningMessage="A warning shown at the same time."
	/>
	<NumberInput label="Number" />
	<SelectInput label="Choice"><option>One</option></SelectInput>
	<RangeInput label="Range" value={1} min={0} max={10} step={1} />
	<CheckboxInput label="A checkbox label that can wrap" />
	<ColorPickerInput
		label="Colors"
		name="colors"
		options={[{ value: 'blue', label: 'Blue', hex: '#5687c8' }]}
		value="blue"
		onchange={() => {}}
	/>
</FormGroup>
