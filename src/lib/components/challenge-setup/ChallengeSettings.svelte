<script lang="ts">
	interface Props {
		name: string;
		fairnessWeight: number;
		onNameChange: (name: string) => void;
		onFairnessWeightChange: (weight: number) => void;
	}

	let { name, fairnessWeight, onNameChange, onFairnessWeightChange }: Props = $props();
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
	<label class="fairness-setting">
		<span>Fairness weight</span>
		<div class="fairness-control">
			<input
				id="fairness-weight"
				aria-label="Fairness weight"
				value={fairnessWeight}
				type="range"
				min="0"
				max="10"
				step="0.01"
				oninput={(event) => onFairnessWeightChange(event.currentTarget.valueAsNumber)}
			/>
			<output for="fairness-weight">{fairnessWeight.toFixed(2)}</output>
		</div>
	</label>
</fieldset>
