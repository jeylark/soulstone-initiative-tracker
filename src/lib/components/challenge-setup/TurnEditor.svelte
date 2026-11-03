<script lang="ts">
	import type { Turn, TurnInitiative } from '#lib';
	import type { InitiativeChoice, TurnEditorChange, TurnTarget } from './challenge-setup-types';

	interface Props {
		turn: Readonly<Turn>;
		targetTurns: readonly TurnTarget[];
		onChange: (change: Readonly<TurnEditorChange>) => void;
	}

	let { turn, targetTurns, onChange }: Props = $props();

	function initiativeChoice(initiative: Readonly<TurnInitiative> | null): InitiativeChoice {
		if (!initiative) return 'none';
		if (initiative.kind === 'roll' || initiative.kind === 'static') return initiative.kind;
		if (initiative.kind === 'fixed-position') {
			return initiative.from === 'top' ? 'fixed-top' : 'fixed-bottom';
		}
		return `relative-${initiative.relation}`;
	}
</script>

<div class="turn-settings">
	<label>
		<span>Turn initiative</span>
		<select
			value={initiativeChoice(turn.initiative)}
			onchange={(event) =>
				onChange({ kind: 'choice', choice: event.currentTarget.value as InitiativeChoice })}
		>
			<option value="none">No initiative</option>
			<option value="roll">Roll or enter a result</option>
			<option value="static">Static value</option>
			<option value="fixed-top">Fixed position from top</option>
			<option value="fixed-bottom">Fixed position from bottom</option>
			<option value="relative-before" disabled={!targetTurns.length}>Before another turn</option>
			<option value="relative-after" disabled={!targetTurns.length}>After another turn</option>
		</select>
	</label>
	{#if turn.initiative?.kind === 'static'}
		<label>
			<span>Static initiative</span>
			<input
				value={turn.initiative.value}
				type="number"
				step="1"
				oninput={(event) =>
					onChange({ kind: 'static-value', value: event.currentTarget.valueAsNumber })}
			/>
		</label>
	{:else if turn.initiative?.kind === 'fixed-position'}
		<label>
			<span>Count from</span>
			<select
				value={turn.initiative.from}
				onchange={(event) =>
					onChange({ kind: 'fixed-from', from: event.currentTarget.value as 'top' | 'bottom' })}
			>
				<option value="top">Top</option>
				<option value="bottom">Bottom</option>
			</select>
		</label>
		<label>
			<span>Position</span>
			<input
				value={turn.initiative.position}
				type="number"
				min="1"
				step="1"
				oninput={(event) =>
					onChange({ kind: 'fixed-position', position: event.currentTarget.valueAsNumber })}
			/>
		</label>
	{:else if turn.initiative?.kind === 'relative-position'}
		<label>
			<span>Relationship</span>
			<select
				value={turn.initiative.relation}
				onchange={(event) =>
					onChange({
						kind: 'relative-relation',
						relation: event.currentTarget.value as 'before' | 'after'
					})}
			>
				<option value="before">Before</option>
				<option value="after">After</option>
			</select>
		</label>
		<label>
			<span>Distance</span>
			<input
				value={turn.initiative.distance}
				type="number"
				min="0"
				step="1"
				oninput={(event) =>
					onChange({ kind: 'relative-distance', distance: event.currentTarget.valueAsNumber })}
			/>
		</label>
		<label>
			<span>Target turn</span>
			<select
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
			</select>
		</label>
	{/if}
</div>
