<script lang="ts">
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

<fieldset class="settings">
	<legend>Challenge settings</legend>
	<label>
		<span>Challenge name</span>
		<input
			value={name}
			autocomplete="off"
			oninput={(event) => onNameChange(event.currentTarget.value)}
		/>
	</label>
	<label>
		<span>Fairness weight</span>
		<div class="fairness-control">
			<input
				id="fairness-weight"
				type="range"
				min="0"
				max="10"
				step="0.01"
				aria-label="Fairness weight"
				value={Math.min(fairnessWeight, 10)}
				oninput={(event) => onFairnessWeightChange(event.currentTarget.valueAsNumber)}
			/>
			<input
				aria-label="Fairness weight"
				value={fairnessWeight}
				type="number"
				min="0"
				step="any"
				oninput={(event) => {
					const weight = event.currentTarget.valueAsNumber;
					if (Number.isFinite(weight) && weight >= 0) onFairnessWeightChange(weight);
				}}
			/>
		</div>
		<p class="fairness-description" aria-live="polite">{getFairnessDescription(fairnessWeight)}</p>
	</label>
</fieldset>
