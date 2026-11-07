<script lang="ts">
	import type { StableId, TurnDisplay } from '#lib/challenge';
	import { ActionButton, Card } from '#lib/components';

	interface Props {
		/** Every current group of tied same-faction turns. */
		groups: readonly (readonly StableId[])[];
		/** Orders the DM has already chosen. */
		decisions: readonly (readonly StableId[])[];
		turnDisplayLookup: ReadonlyMap<StableId, TurnDisplay>;
		/** Called with a group's turn IDs in the chosen play order. */
		onDecide: (order: readonly StableId[]) => void;
	}

	let { groups, decisions, turnDisplayLookup, onDecide }: Props = $props();

	function decisionFor(group: readonly StableId[]): readonly StableId[] | undefined {
		return decisions.find(
			(decision) =>
				decision.length === group.length && decision.every((turnId) => group.includes(turnId))
		);
	}

	function label(turnId: StableId): string {
		return turnDisplayLookup.get(turnId)?.label ?? 'Unknown turn';
	}

	function move(order: readonly StableId[], index: number, offset: -1 | 1): void {
		const next = [...order];
		[next[index], next[index + offset]] = [next[index + offset], next[index]];
		onDecide(next);
	}
</script>

{#if groups.length > 0}
	<section aria-label="Initiative ties" class="ties">
		<Card title="Initiative ties" headingLevel="h2">
			<p>Order turns in the same faction that have equal initiative.</p>
			{#each groups as group, groupIndex (group.join())}
				{@const decision = decisionFor(group)}
				{@const order = decision ?? group}
				<div class="tie-group" role="group" aria-label={`Tie ${groupIndex + 1}`}>
					<p>{decision ? 'Ordered' : 'Needs ordering'}</p>
					<ol aria-label={`Tie ${groupIndex + 1} order`}>
						{#each order as turnId, index (turnId)}
							<li>
								<span>{label(turnId)}</span>
								<ActionButton
									variant="neutral"
									disabled={index === 0}
									aria-label={`Move ${label(turnId)} earlier`}
									onclick={() => move(order, index, -1)}>Up</ActionButton
								>
								<ActionButton
									variant="neutral"
									disabled={index === order.length - 1}
									aria-label={`Move ${label(turnId)} later`}
									onclick={() => move(order, index, 1)}>Down</ActionButton
								>
							</li>
						{/each}
					</ol>
					{#if !decision}
						<ActionButton
							aria-label={`Confirm default order for tie ${groupIndex + 1}`}
							onclick={() => onDecide(order)}>Confirm default order</ActionButton
						>
					{/if}
				</div>
			{/each}
		</Card>
	</section>
{/if}

<style>
	.ties {
		margin-block: 16px;
	}
	.tie-group {
		margin-block: 12px;
	}
</style>
