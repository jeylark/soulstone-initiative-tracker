<script lang="ts">
	import type { InitiativeRollMode, InitiativeRollModes } from '#lib';

	interface Props {
		name: string;
		fairnessWeight: number;
		initiativeRollModes: Readonly<InitiativeRollModes>;
		onNameChange: (name: string) => void;
		onFairnessWeightChange: (weight: number) => void;
		onRollModeChange: (category: keyof InitiativeRollModes, mode: InitiativeRollMode) => void;
	}

	let {
		name,
		fairnessWeight,
		initiativeRollModes,
		onNameChange,
		onFairnessWeightChange,
		onRollModeChange
	}: Props = $props();
</script>

<section class="settings" aria-labelledby="challenge-settings-heading">
	<h2 id="challenge-settings-heading">Challenge settings</h2>
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
	<label>
		<span>Character initiative</span>
		<select
			value={initiativeRollModes.characters}
			onchange={(event) =>
				onRollModeChange('characters', event.currentTarget.value as InitiativeRollMode)}
		>
			<option value="manual">Enter results manually</option>
			<option value="app">Roll in the app</option>
		</select>
	</label>
	<label>
		<span>NPC initiative</span>
		<select
			value={initiativeRollModes.npcs}
			onchange={(event) =>
				onRollModeChange('npcs', event.currentTarget.value as InitiativeRollMode)}
		>
			<option value="manual">Enter results manually</option>
			<option value="app">Roll in the app</option>
		</select>
	</label>
</section>
