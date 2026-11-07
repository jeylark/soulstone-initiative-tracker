<script lang="ts">
	import { Card, NumberInput, RangeInput, TextInput } from '#lib/components';

	interface Props {
		name: string;
		fairnessWeight: number;
		onNameChange: (name: string) => void;
		onFairnessWeightChange: (weight: number) => void;
	}

	let { name, fairnessWeight, onNameChange, onFairnessWeightChange }: Props = $props();

	function getFairnessDescription(weight: number): string {
		if (weight === 0) return 'Pure initiative ordering.';
		if (weight < 2) return 'Initiative remains the main influence on turn order.';
		if (weight < 4) return 'Initiative and faction balance have similar influence.';
		if (weight < 10) return 'Faction balance has a stronger influence than initiative.';
		return 'Turn order approaches a proportional round-robin across factions.';
	}
</script>

<Card title="Challenge settings" headerSize="large">
	<fieldset class="settings">
		<legend>Challenge settings</legend>
		<TextInput
			label="Challenge name"
			value={name}
			autocomplete="off"
			oninput={(event) => onNameChange(event.currentTarget.value)}
		/>
		<fieldset class="fairness-setting">
			<legend>Fairness weight</legend>
			<div class="fairness-control">
				<RangeInput
					label="Fairness weight slider"
					isLabelVisuallyHidden
					id="fairness-weight"
					min="0"
					max="10"
					step="0.01"
					value={Math.min(fairnessWeight, 10)}
					oninput={(event) => onFairnessWeightChange(event.currentTarget.valueAsNumber)}
				/>
				<NumberInput
					label="Fairness weight value"
					isLabelVisuallyHidden
					class="fairness-weight-input"
					value={fairnessWeight}
					min="0"
					step="any"
					oninput={(event) => {
						const weight = event.currentTarget.valueAsNumber;
						if (Number.isFinite(weight) && weight >= 0) onFairnessWeightChange(weight);
					}}
				/>
			</div>
			<p class="fairness-description" aria-live="polite">
				{getFairnessDescription(fairnessWeight)}
			</p>
		</fieldset>
	</fieldset>
</Card>
