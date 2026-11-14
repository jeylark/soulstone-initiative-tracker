<script lang="ts">
	import type { ValidationIssue } from '#lib/challenge';
	import { Card, RangeInput, TextInput } from '#lib/components';
	import { issueMessage } from './issue-messages';

	interface Props {
		name: string;
		fairnessWeight: number;
		isDisabled: boolean;
		setupIssues: readonly ValidationIssue[];
		onNameChange: (name: string) => void;
		onFairnessWeightChange: (weight: number) => void;
	}

	let {
		name,
		fairnessWeight,
		isDisabled,
		setupIssues,
		onNameChange,
		onFairnessWeightChange
	}: Props = $props();
	let nameError = $derived(issueMessage(setupIssues, '$.name'));
	let fairnessWeightError = $derived(issueMessage(setupIssues, '$.fairnessWeight'));

	function getFairnessDescription(weight: number): string {
		if (weight === 0) return 'Pure initiative ordering.';
		if (weight < 2) return 'Initiative remains the main influence on turn order.';
		if (weight < 4) return 'Initiative and faction balance have similar influence.';
		if (weight < 10) return 'Faction balance has a stronger influence than initiative.';
		return 'Turn order approaches a proportional round-robin across factions.';
	}
</script>

<Card title="Challenge settings" headerSize="large">
	<fieldset class="settings" disabled={isDisabled}>
		<legend class="visually-hidden" data-visually-hidden>Challenge settings</legend>
		<TextInput
			label="Challenge name"
			value={name}
			autocomplete="off"
			isInvalid={nameError !== undefined}
			invalidMessage={nameError}
			oninput={(event) => onNameChange(event.currentTarget.value)}
		/>
		<fieldset class="fairness-setting">
			<legend>Fairness weight</legend>
			<RangeInput
				label="Fairness weight"
				isLabelVisuallyHidden
				id="fairness-weight"
				numberClass="fairness-weight-input"
				value={fairnessWeight}
				min={0}
				max={10}
				step={0.01}
				numberMin={0}
				numberStep="any"
				isInvalid={fairnessWeightError !== undefined}
				invalidMessage={fairnessWeightError}
				onSliderInput={(event) => onFairnessWeightChange(event.currentTarget.valueAsNumber)}
				onNumberInput={(event) => {
					const weight = event.currentTarget.valueAsNumber;
					if (Number.isFinite(weight)) onFairnessWeightChange(weight);
				}}
			/>
			<p class="fairness-description" aria-live="polite">
				{getFairnessDescription(fairnessWeight)}
			</p>
		</fieldset>
	</fieldset>
</Card>

<style>
	.settings {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px 24px;
		min-inline-size: 0;
		margin: 0;
		border: 0;
		padding: 0;
		background: transparent;
	}

	.fairness-setting {
		display: grid;
		flex: 1 1 180px;
		gap: 6px;
		min-width: 0;
		margin: 0;
		border: 0;
		padding: 0;
		background: transparent;
		font-size: 14px;
	}

	.fairness-setting > legend {
		padding: 0;
		font: inherit;
	}

	.fairness-description {
		margin: 0;
		font-size: 13px;
	}

	@media (max-width: 640px) {
		.settings {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
