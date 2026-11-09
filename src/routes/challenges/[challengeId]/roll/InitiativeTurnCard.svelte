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
		canRoll,
		isInputLocked,
		isRollLocked,
		onInput,
		onRoll
	}: Props = $props();
	let label = $derived(`Initiative for ${title}`);
	let hasWarning = $derived(result !== undefined && result > 18);
</script>

<div class="initiative-card-tone" style={factionColor ? `--faction-color: ${factionColor}` : ''}>
	<Card {title} headingLevel="h3" headerSize="small" spacing="compact" class="initiative-card">
		<div class="initiative-field">
			{#if mode === 'manual'}
				<NumberInput
					label="Initiative"
					aria-label={label}
					min={0}
					step={1}
					{hasWarning}
					warningMessage={hasWarning ? 'Initiative is above 18.' : undefined}
					{isInvalid}
					disabled={isInputLocked}
					invalidMessage={isInvalid ? 'Enter a non-negative whole number.' : undefined}
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
							onclick={onRoll}
						>
							Reroll
						</ActionButton>
					{:else}
						<ActionButton
							aria-label={`Roll initiative for ${title}`}
							disabled={!canRoll || isRollLocked}
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

	.initiative-card-tone :global(.initiative-card) {
		width: auto;
		max-width: 100%;
		background: color-mix(
			in srgb,
			var(--faction-color, var(--color-surface)) 12%,
			var(--color-surface)
		);
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
