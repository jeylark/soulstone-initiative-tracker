<script lang="ts">
	import type { InitiativeRollMode } from '#lib/challenge';
	import { ActionButton, Card, NumberInput } from '#lib/components';

	interface Props {
		title: string;
		mode: InitiativeRollMode;
		factionColor: string | undefined;
		result: number | undefined;
		inputValue: string;
		isInvalid: boolean;
		/** Whether generation reported this turn as missing an initiative result. */
		isMissingResult: boolean;
		/** Whether the initiative stat allows an app roll. */
		canRoll: boolean;
		/** Whether the manual field is read-only. */
		isInputLocked: boolean;
		/** Whether rolling or rerolling is not allowed. */
		isRollLocked: boolean;
		onInput: (value: string) => void;
		onRoll: () => void;
	}

	let {
		title,
		mode,
		factionColor,
		result,
		inputValue,
		isInvalid,
		isMissingResult,
		canRoll,
		isInputLocked,
		isRollLocked,
		onInput,
		onRoll
	}: Props = $props();
	let label = $derived(`Initiative for ${title}`);
	let hasWarning = $derived(result !== undefined && result > 18);
	let isMissingInputResult = $derived(
		isMissingResult && result === undefined && inputValue.trim() === ''
	);
	let hasMissingResult = $derived(isMissingResult && result === undefined);
</script>

<div
	class="initiative-card-tone"
	class:initiative-card-tone--app={mode === 'app'}
	style={factionColor ? `--faction-color: ${factionColor}` : ''}
>
	<Card
		{title}
		headingLevel="h3"
		headerSize="small"
		spacing="compact"
		isAccented
		accentColor={factionColor}
		isContentSized
	>
		<div class="initiative-field">
			{#if mode === 'manual'}
				<NumberInput
					label="Initiative"
					aria-label={label}
					min={0}
					step={1}
					{hasWarning}
					warningMessage={hasWarning ? 'Initiative is above 18.' : undefined}
					isInvalid={isInvalid || isMissingInputResult}
					disabled={isInputLocked}
					invalidMessage={isInvalid
						? 'Enter a non-negative whole number.'
						: isMissingInputResult
							? 'Initiative result is required.'
							: undefined}
					value={inputValue}
					oninput={(event) => onInput(event.currentTarget.value)}
				/>
			{:else}
				<div class="app-initiative-turn">
					{#if result !== undefined}
						<output>Initiative result: {result}</output>
						<ActionButton
							aria-label={`Reroll initiative for ${title}`}
							disabled={!canRoll || isRollLocked}
							isInvalid={hasMissingResult}
							invalidMessage={hasMissingResult ? 'Initiative result is required.' : undefined}
							onclick={onRoll}
						>
							Reroll
						</ActionButton>
					{:else}
						<ActionButton
							aria-label={`Roll initiative for ${title}`}
							disabled={!canRoll || isRollLocked}
							isInvalid={hasMissingResult}
							invalidMessage={hasMissingResult ? 'Initiative result is required.' : undefined}
							onclick={onRoll}
						>
							Roll
						</ActionButton>
					{/if}
					{#if !canRoll}
						<p role="status">Cannot roll because the initiative stat is missing or invalid.</p>
					{/if}
				</div>
			{/if}
		</div>
	</Card>
</div>

<style>
	.initiative-card-tone {
		flex: 0 1 max-content;
		min-width: 0;
		max-width: 100%;
	}

	.initiative-card-tone--app {
		flex-basis: 20rem;
		width: 20rem;
		overflow-wrap: anywhere;
	}

	.initiative-field {
		min-width: 0;
	}

	.app-initiative-turn {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 8px;
	}

	.app-initiative-turn p {
		grid-column: 1 / -1;
		margin: 0;
	}
</style>
