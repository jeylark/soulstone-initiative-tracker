<script lang="ts">
	import type { Turn, TurnInitiative, ValidationIssue } from '#lib/challenge';
	import type { InitiativeChoice, TurnEditorChange, TurnTarget } from './challenge-setup-types';
	import { issueMessage } from './issue-messages';
	import { NumberInput, SelectInput } from '#lib/components';

	interface Props {
		turn: Readonly<Turn>;
		setupIssues: readonly ValidationIssue[];
		issuePath: string;
		targetTurns: readonly TurnTarget[];
		siblingCount: number;
		isConfigurable: boolean;
		onChange: (change: Readonly<TurnEditorChange>) => void;
	}

	let { turn, setupIssues, issuePath, targetTurns, siblingCount, isConfigurable, onChange }: Props =
		$props();
	let positionError = $derived(issueMessage(setupIssues, `${issuePath}.position`));
	let indexError = $derived(issueMessage(setupIssues, `${issuePath}.index`));
	let relativeError = $derived(issueMessage(setupIssues, issuePath));
	let targetError = $derived(
		issueMessage(setupIssues, `${issuePath}.targetTurnId`) ?? relativeError
	);
	let staticError = $derived(issueMessage(setupIssues, `${issuePath}.value`));

	function initiativeChoice(initiative: Readonly<TurnInitiative>): InitiativeChoice {
		if (initiative.kind === 'roll') return initiative.mode === 'app' ? 'roll-app' : 'roll-manual';
		if (initiative.kind === 'static') return initiative.kind;
		if (initiative.kind === 'fixed-position') {
			return initiative.from === 'top' ? 'fixed-top' : 'fixed-bottom';
		}
		return `relative-${initiative.relation}`;
	}
</script>

<div class="turn-settings">
	<SelectInput
		label="Turn initiative"
		value={initiativeChoice(turn.initiative)}
		disabled={!isConfigurable}
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
			disabled={!isConfigurable}
			isInvalid={staticError !== undefined}
			invalidMessage={staticError}
			value={turn.initiative.value}
			step="1"
			oninput={(event) => {
				const value = event.currentTarget.valueAsNumber;
				if (Number.isFinite(value)) onChange({ kind: 'static-value', value });
			}}
		/>
	{:else if turn.initiative.kind === 'fixed-position'}
		<NumberInput
			label="Position"
			disabled={!isConfigurable}
			isInvalid={positionError !== undefined}
			invalidMessage={positionError}
			value={turn.initiative.position}
			min="1"
			step="1"
			oninput={(event) => {
				const position = event.currentTarget.valueAsNumber;
				if (Number.isFinite(position)) onChange({ kind: 'fixed-position', position });
			}}
		/>
	{:else if turn.initiative.kind === 'relative-position'}
		{#if siblingCount > 1 || indexError !== undefined}
			<NumberInput
				label="Index"
				disabled={!isConfigurable}
				isInvalid={indexError !== undefined}
				invalidMessage={indexError}
				value={turn.initiative.index ?? ''}
				min="1"
				step="1"
				oninput={(event) => {
					const index = event.currentTarget.valueAsNumber;
					onChange({
						kind: 'relative-index',
						index: Number.isFinite(index) ? index : undefined
					});
				}}
			/>
		{/if}
		<SelectInput
			label="Target turn"
			disabled={!isConfigurable}
			isInvalid={targetError !== undefined}
			invalidMessage={targetError}
			value={turn.initiative.targetTurnId}
			onchange={(event) =>
				onChange({
					kind: 'relative-target',
					targetTurnId: event.currentTarget.value as TurnTarget['id']
				})}
		>
			{#if !targetTurns.some((target) => turn.initiative.kind === 'relative-position' && target.id === turn.initiative.targetTurnId)}
				<option value={turn.initiative.targetTurnId} disabled>Missing target turn</option>
			{/if}
			{#each targetTurns as target (target.id)}
				<option value={target.id}>{target.name}</option>
			{/each}
		</SelectInput>
	{/if}
</div>
