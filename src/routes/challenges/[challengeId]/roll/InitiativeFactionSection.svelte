<script lang="ts">
	import type { DeepReadonly } from '#lib';
	import {
		FACTION_COLORS,
		type ChallengeCreature,
		type Faction,
		type InitiativeResults,
		type StableId,
		type TurnDisplay
	} from '#lib/challenge';
	import { Card } from '#lib/components';
	import InitiativeTurnCard from './InitiativeTurnCard.svelte';

	interface Props {
		faction: DeepReadonly<Faction>;
		creatures: DeepReadonly<ChallengeCreature[]>;
		turnDisplayLookup: ReadonlyMap<StableId, TurnDisplay>;
		initiativeResults: Readonly<InitiativeResults>;
		initiativeInputs: Readonly<Partial<Record<StableId, string>>>;
		isInvalidInput: (value: string) => boolean;
		/** Whether a turn's manual result is read-only. */
		isInputLocked: (turnId: StableId) => boolean;
		/** Whether a turn's app result cannot be rolled or rerolled. */
		isRollLocked: (turnId: StableId) => boolean;
		canRoll: (creature: DeepReadonly<ChallengeCreature>) => boolean;
		onInput: (turnId: StableId, value: string) => void;
		onRoll: (creature: DeepReadonly<ChallengeCreature>, turnId: StableId) => void;
	}

	let {
		faction,
		creatures,
		turnDisplayLookup,
		initiativeResults,
		initiativeInputs,
		isInvalidInput,
		canRoll,
		isInputLocked,
		isRollLocked,
		onInput,
		onRoll
	}: Props = $props();

	let factionColor = $derived(FACTION_COLORS.find((color) => color.value === faction.color));
	let factionCreatures = $derived(
		creatures.filter(
			(creature) =>
				creature.factionId === faction.id &&
				creature.turns.some((turn) => turn.initiative.kind === 'roll')
		)
	);

	function rollingTurns(creature: DeepReadonly<ChallengeCreature>) {
		return creature.turns.flatMap((turn) => {
			if (turn.initiative.kind !== 'roll') return [];
			const display = turnDisplayLookup.get(turn.id);
			return display ? [{ turn, display, mode: turn.initiative.mode }] : [];
		});
	}
</script>

{#if factionCreatures.length > 0}
	<section aria-label={faction.name} class="faction-section">
		<Card
			title={faction.name}
			headingLevel="h2"
			headerSize="medium"
			variant="inset"
			spacing="compact"
		>
			<div class="initiative-cards">
				{#each factionCreatures as creature (creature.id)}
					{@const turnsToRoll = rollingTurns(creature)}
					{#each turnsToRoll as { turn, display, mode } (turn.id)}
						{@const result = initiativeResults[turn.id]}
						{@const inputValue = initiativeInputs[turn.id] ?? ''}
						<InitiativeTurnCard
							title={display.label}
							{mode}
							factionColor={factionColor?.hex}
							{result}
							{inputValue}
							isInvalid={isInvalidInput(inputValue)}
							canRoll={canRoll(creature)}
							isInputLocked={isInputLocked(turn.id)}
							isRollLocked={isRollLocked(turn.id)}
							onInput={(value) => onInput(turn.id, value)}
							onRoll={() => onRoll(creature, turn.id)}
						/>
					{/each}
				{/each}
			</div>
		</Card>
	</section>
{/if}

<style>
	.faction-section {
		min-width: 0;
	}

	.initiative-cards {
		display: flex;
		flex-wrap: wrap;
		align-items: start;
		gap: 12px;
	}
</style>
