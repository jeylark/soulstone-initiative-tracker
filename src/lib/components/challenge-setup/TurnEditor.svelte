<script lang="ts">
	import type { Turn, TurnInitiative } from '#lib';
	import type { InitiativeChoice, TurnEditorChange, TurnTarget } from './challenge-setup-types';
	import Card from '../Card.svelte';
	import EntityListItem from '../EntityListItem.svelte';
	import NumberInput from '../forms/NumberInput.svelte';
	import SelectInput from '../forms/SelectInput.svelte';

	interface Props {
		turn: Readonly<Turn>;
		turnNumber: number;
		creatureName: string;
		targetTurns: readonly TurnTarget[];
		onChange: (change: Readonly<TurnEditorChange>) => void;
		onRemove: () => void;
	}

	let { turn, turnNumber, creatureName, targetTurns, onChange, onRemove }: Props = $props();

	function initiativeChoice(initiative: Readonly<TurnInitiative>): InitiativeChoice {
		if (initiative.kind === 'roll') return initiative.mode === 'app' ? 'roll-app' : 'roll-manual';
		if (initiative.kind === 'static') return initiative.kind;
		if (initiative.kind === 'fixed-position') {
			return initiative.from === 'top' ? 'fixed-top' : 'fixed-bottom';
		}
		return `relative-${initiative.relation}`;
	}
</script>

<Card
	title={`Turn ${turnNumber}`}
	headingLevel="h5"
	headerSize="compact"
	variant="inset"
	spacing="compact"
	class="turn-card-wrapper"
>
	<EntityListItem
		class="turn-card"
		aria-label={`Turn ${turnNumber}`}
		legend={`Turn ${turnNumber}`}
		removeLabel={`Remove Turn ${turnNumber} for ${creatureName}`}
		removeText="Remove turn"
		{onRemove}
	>
		<div class="turn-settings">
			<SelectInput
				label="Turn initiative"
				value={initiativeChoice(turn.initiative)}
				onchange={(event) =>
					onChange({ kind: 'choice', choice: event.currentTarget.value as InitiativeChoice })}
			>
				<option value="roll-app">Calculate roll</option>
				<option value="roll-manual">Enter a result</option>
				<option value="static">Static value</option>
				<option value="fixed-top">Fixed position from top</option>
				<option value="fixed-bottom">Fixed position from bottom</option>
				<option value="relative-before" disabled={!targetTurns.length}>Before another turn</option>
				<option value="relative-after" disabled={!targetTurns.length}>After another turn</option>
			</SelectInput>
			{#if turn.initiative.kind === 'static'}
				<NumberInput
					label="Static initiative"
					value={turn.initiative.value}
					step="1"
					oninput={(event) =>
						onChange({ kind: 'static-value', value: event.currentTarget.valueAsNumber })}
				/>
			{:else if turn.initiative.kind === 'fixed-position'}
				<SelectInput
					label="Count from"
					value={turn.initiative.from}
					onchange={(event) =>
						onChange({ kind: 'fixed-from', from: event.currentTarget.value as 'top' | 'bottom' })}
				>
					<option value="top">Top</option>
					<option value="bottom">Bottom</option>
				</SelectInput>
				<NumberInput
					label="Position"
					value={turn.initiative.position}
					min="1"
					step="1"
					oninput={(event) =>
						onChange({ kind: 'fixed-position', position: event.currentTarget.valueAsNumber })}
				/>
			{:else if turn.initiative.kind === 'relative-position'}
				<SelectInput
					label="Relationship"
					value={turn.initiative.relation}
					onchange={(event) =>
						onChange({
							kind: 'relative-relation',
							relation: event.currentTarget.value as 'before' | 'after'
						})}
				>
					<option value="before">Before</option>
					<option value="after">After</option>
				</SelectInput>
				<NumberInput
					label="Distance"
					value={turn.initiative.distance}
					min="0"
					step="1"
					oninput={(event) =>
						onChange({ kind: 'relative-distance', distance: event.currentTarget.valueAsNumber })}
				/>
				<SelectInput
					label="Target turn"
					value={turn.initiative.targetTurnId}
					onchange={(event) =>
						onChange({
							kind: 'relative-target',
							targetTurnId: event.currentTarget.value as TurnTarget['id']
						})}
				>
					{#each targetTurns as target (target.id)}
						<option value={target.id}>{target.name}</option>
					{/each}
				</SelectInput>
			{/if}
		</div>
	</EntityListItem>
</Card>
